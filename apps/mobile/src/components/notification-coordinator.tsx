import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { authClient } from "../lib/auth-client";
import { getApnsEnvironment } from "../lib/apns-environment";
import {
  notificationHref,
  parseExpenseNotificationData,
  type ExpenseNotificationData,
} from "../lib/notification-data";
import { getPushInstallationId } from "../lib/push-installation";
import { api } from "../lib/trpc";

if (process.env.EXPO_OS === "ios") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function notificationsAllowed(
  permissions: Notifications.NotificationPermissionsStatus,
) {
  const status = permissions.ios?.status;
  return (
    status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export function NotificationCoordinator() {
  const session = authClient.useSession();
  const profile = api.profile.me.useQuery(undefined, {
    enabled: Boolean(session.data?.user),
  });
  const { mutateAsync: registerPushInstallation } =
    api.push.register.useMutation();
  const utils = api.useUtils();
  const handledResponseId = useRef<string | undefined>(undefined);

  const registerToken = useCallback(
    async (token: Notifications.DevicePushToken) => {
      if (token.type !== "ios" || typeof token.data !== "string") return;
      await registerPushInstallation({
        installationId: await getPushInstallationId(),
        environment: await getApnsEnvironment(),
        token: token.data,
      });
    },
    [registerPushInstallation],
  );

  const refreshForNotification = useCallback(
    (data: ExpenseNotificationData) => {
      void Promise.all([
        utils.friends.list.invalidate(),
        utils.groups.list.invalidate(),
        utils.groups.detail.invalidate({ groupId: data.groupId }),
        data.eventType === "expense.deleted" ||
        data.eventType === "expense.summary"
          ? Promise.resolve()
          : utils.expenses.detail.invalidate({ expenseId: data.expenseId }),
      ]);
    },
    [utils],
  );

  const handleResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledResponseId.current === responseId) return;
      const data = parseExpenseNotificationData(
        response.notification.request.content.data,
      );
      if (!data) return;
      handledResponseId.current = responseId;
      refreshForNotification(data);
      router.push(notificationHref(data));
      void Notifications.clearLastNotificationResponseAsync();
    },
    [refreshForNotification],
  );

  useEffect(() => {
    if (
      Platform.OS !== "ios" ||
      !session.data?.user.id ||
      !profile.data?.onboardedAt
    ) {
      return;
    }
    let active = true;
    let syncing = false;

    const syncRegistration = async () => {
      if (syncing) return;
      syncing = true;
      try {
        let permissions = await Notifications.getPermissionsAsync();
        if (
          permissions.ios?.status ===
          Notifications.IosAuthorizationStatus.NOT_DETERMINED
        ) {
          permissions = await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          });
        }
        if (!active || !notificationsAllowed(permissions)) return;
        await registerToken(await Notifications.getDevicePushTokenAsync());
      } finally {
        syncing = false;
      }
    };
    const pushTokenSubscription = Notifications.addPushTokenListener(
      (token) => {
        void registerToken(token).catch((cause) => {
          console.warn("Unable to refresh the APNs token", cause);
        });
      },
    );
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          void syncRegistration().catch((cause) => {
            console.warn("Unable to register for expense notifications", cause);
          });
        }
      },
    );

    void syncRegistration().catch((cause) => {
      console.warn("Unable to register for expense notifications", cause);
    });
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && response) handleResponse(response);
      })
      .catch((cause) => {
        console.warn("Unable to handle the last expense notification", cause);
      });

    return () => {
      active = false;
      pushTokenSubscription.remove();
      appStateSubscription.remove();
    };
  }, [
    handleResponse,
    profile.data?.onboardedAt,
    registerToken,
    session.data?.user?.id,
  ]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !session.data?.user?.id) return;
    const received = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = parseExpenseNotificationData(
          notification.request.content.data,
        );
        if (data) refreshForNotification(data);
      },
    );
    const responded =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => {
      received.remove();
      responded.remove();
    };
  }, [handleResponse, refreshForNotification, session.data?.user?.id]);

  return null;
}
