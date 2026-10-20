import { useEffect, useRef } from "react";
import { Alert } from "react-native";

// Keep UIKit's swipe pending until the action has completed.
export function useListAction() {
  const busy = useRef(false);
  const pending = useRef<((success: boolean) => void) | undefined>(undefined);
  useEffect(() => () => pending.current?.(false), []);

  return (options: {
    confirmation?: boolean;
    title: string;
    message: string;
    label: string;
    perform: () => Promise<unknown>;
  }): Promise<boolean> => {
    if (busy.current) return Promise.resolve(false);
    busy.current = true;
    return new Promise((resolve) => {
      let submitted = false;
      let finished = false;
      const finish = (success: boolean) => {
        if (finished) return;
        finished = true;
        busy.current = false;
        pending.current = undefined;
        resolve(success);
      };
      pending.current = finish;
      const submit = async () => {
        if (submitted || finished) return;
        submitted = true;
        try {
          await options.perform();
          finish(true);
        } catch (error) {
          finish(false);
          Alert.alert(
            `Could not ${options.label.toLowerCase()}`,
            error instanceof Error ? error.message : "Please try again.",
          );
        }
      };
      if (options.confirmation === false) {
        void submit();
        return;
      }
      Alert.alert(
        options.title,
        options.message,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              if (!submitted) finish(false);
            },
          },
          {
            text: options.label,
            style: "destructive",
            onPress: submit,
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            if (!submitted) finish(false);
          },
        },
      );
    });
  };
}
