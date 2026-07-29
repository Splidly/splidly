import { Stack, router } from "expo-router";
import { Text, View } from "react-native";
import {
  Avatar,
  BalanceText,
  CollectionScreen,
  EmptyState,
  ErrorState,
  HeaderButton,
  ListRow,
  LoadingState,
  PrimaryButton,
  RowDivider,
  Section,
} from "../../../components/ui";
import { api } from "../../../lib/trpc";
import { shareInvite } from "../../../lib/share-invite";
import { useTheme } from "../../../theme";

export default function FriendsScreen() {
  const theme = useTheme();
  const friends = api.friends.list.useQuery();
  const createInvite = api.invites.create.useMutation({
    onSuccess: (invite) =>
      void shareInvite(invite.url),
  });

  return (
    <>
      <CollectionScreen isEmpty={friends.data?.length === 0}>
        {friends.isPending ? <LoadingState /> : null}
        {friends.error ? <ErrorState message={friends.error.message} /> : null}
        {friends.data?.length === 0 ? (
          <EmptyState
            title="Your people will appear here"
            message="Invite a friend to start a private ledger, or join a group and connect automatically."
            action={
              <PrimaryButton
                label={createInvite.isPending ? "Creating invite…" : "Invite a friend"}
                onPress={() => createInvite.mutate({ kind: "friend" })}
                disabled={createInvite.isPending}
                compact
              />
            }
          />
        ) : null}
        {friends.data && friends.data.length > 0 ? (
          <Section title={`${friends.data.length} ${friends.data.length === 1 ? "friend" : "friends"}`}>
            {friends.data.map(({ friendship, friend, balances }, index) => {
              const name = friend?.displayName ?? "Deleted user";
              return (
                <View key={friendship.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    title={name}
                    subtitle={
                      balances.length === 0
                        ? "All settled"
                        : balances.length === 1
                          ? balances[0]?.contextType === "group"
                            ? "1 group ledger"
                            : "Direct ledger"
                          : `${balances.length} open ledgers`
                    }
                    leading={<Avatar name={name} />}
                    onPress={() => router.push(`/friends/${friendship.id}`)}
                    trailing={
                      balances[0] ? (
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <BalanceText
                            value={balances[0].viewerAmount}
                            prefix={BigInt(balances[0].viewerAmount.minor) < 0n ? "You owe " : ""}
                          />
                          {balances.length > 1 ? (
                            <Text style={{ color: theme.muted, fontSize: 12 }}>
                              +{balances.length - 1} more
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={{ color: theme.positive, fontWeight: "600" }}>
                          Settled
                        </Text>
                      )
                    }
                  />
                </View>
              );
            })}
          </Section>
        ) : null}
        {createInvite.error ? (
          <ErrorState message={createInvite.error.message} />
        ) : null}
      </CollectionScreen>
      <Stack.Screen
        options={{
          title: "Friends",
          ...(process.env.EXPO_OS !== "ios" && {
            headerRight: () => (
              <HeaderButton
                label="Invite a friend"
                glyph="Invite"
                disabled={createInvite.isPending}
                onPress={() => createInvite.mutate({ kind: "friend" })}
              />
            ),
          }),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="person.badge.plus"
          accessibilityLabel="Invite a friend"
          disabled={createInvite.isPending}
          onPress={() => createInvite.mutate({ kind: "friend" })}
        />
      </Stack.Toolbar>
    </>
  );
}
