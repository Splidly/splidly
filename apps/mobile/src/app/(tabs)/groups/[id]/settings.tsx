import type { CurrencyCode } from "@splidly/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";
import {
  Avatar,
  ErrorState,
  Field,
  FormSection,
  ListRow,
  PrimaryButton,
  RowDivider,
  Screen,
  Section,
} from "../../../../components/ui";
import { CurrencyField } from "../../../../components/currency-field";
import { shareInvite } from "../../../../lib/share-invite";
import { api } from "../../../../lib/trpc";

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = api.groups.detail.useQuery({ groupId: id });
  const me = api.profile.me.useQuery();
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  useEffect(() => {
    if (!detail.data) return;
    setName(detail.data.group.name);
    setCurrency(detail.data.group.currency as CurrencyCode);
    setSimplifyDebts(detail.data.group.simplifyDebts);
  }, [detail.data]);
  const update = api.groups.update.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.groups.detail.invalidate({ groupId: id }),
        utils.groups.list.invalidate(),
      ]);
      router.back();
    },
  });
  const removeMember = api.groups.removeMember.useMutation({
    async onSuccess() {
      await detail.refetch();
    },
  });
  const createInvite = api.invites.create.useMutation({
    onSuccess: (invite) =>
      void shareInvite(invite.url),
  });
  const leave = api.groups.leave.useMutation({
    async onSuccess() {
      await utils.groups.list.invalidate();
      router.dismissTo("/groups");
    },
  });
  const archive = api.groups.archive.useMutation({
    async onSuccess() {
      await utils.groups.list.invalidate();
      router.dismissTo("/groups");
    },
  });
  const deleteGroup = api.groups.delete.useMutation({
    async onSuccess() {
      await utils.groups.list.invalidate();
      router.dismissTo("/groups");
    },
  });
  const group = detail.data?.group;
  return (
    <Screen>
      <FormSection
        title="Details"
        footer="Every active member can manage this group. Currency locks after the first financial entry."
      >
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
        />
        <CurrencyField
          label="Currency"
          value={currency}
          onValueChange={setCurrency}
        />
      </FormSection>
      <Section
        title="Balances"
        footer="When enabled, everyone’s net group balance is combined into the smallest repayment plan instead of preserving who originally paid for whom."
      >
        <ListRow
          title="Simplify debts"
          subtitle="Use fewer payments to settle the group"
          trailing={
            <Switch
              accessibilityLabel="Simplify debts"
              value={simplifyDebts}
              onValueChange={setSimplifyDebts}
            />
          }
        />
      </Section>
      <PrimaryButton
        label={update.isPending ? "Saving…" : "Save changes"}
        disabled={!group || update.isPending || name.trim().length === 0}
        onPress={() =>
          group &&
          update.mutate({
            groupId: id,
            expectedVersion: group.version,
            name: name.trim(),
            currency,
            simplifyDebts,
          })
        }
      />
      <Section title="Members">
        <ListRow
          title={createInvite.isPending ? "Creating invitation…" : "Invite people"}
          subtitle="Share a link to join this group"
          onPress={() =>
            createInvite.mutate({ kind: "group", groupId: id })
          }
        />
        {detail.data?.members.map((member) => {
          const isMe = member.userId === me.data?.userId;
          return (
            <View key={member.userId}>
              <RowDivider />
              <ListRow
                title={member.displayName}
                subtitle={isMe ? "You" : `Home currency · ${member.homeCurrency}`}
                leading={
                  <Avatar
                    name={member.displayName}
                    colorKey={member.userId}
                  />
                }
                valueTone="negative"
                {...(!isMe ? { value: "Remove" } : {})}
                {...(!isMe && !removeMember.isPending
                  ? {
                      onPress: () =>
                        Alert.alert(
                          `Remove ${member.displayName}?`,
                          "They can rejoin later with a new invitation.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () =>
                                removeMember.mutate({
                                  groupId: id,
                                  userId: member.userId,
                                }),
                            },
                          ],
                        ),
                    }
                  : {})}
              />
            </View>
          );
        })}
      </Section>
      <Section title="Group actions">
        <ListRow
          title="Leave group"
          destructive
          onPress={() =>
            Alert.alert("Leave group?", "Your group balance must be zero.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Leave",
                style: "destructive",
                onPress: () => leave.mutate({ groupId: id }),
              },
            ])
          }
        />
        <RowDivider inset={16} />
        <ListRow
          title="Archive group"
          destructive
          onPress={() =>
            group &&
            Alert.alert(
              "Archive group?",
              "The group will be removed from the active list.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Archive",
                  style: "destructive",
                  onPress: () =>
                    archive.mutate({
                      groupId: id,
                      expectedVersion: group.version,
                    }),
                },
              ],
            )
          }
        />
        {group?.createdBy === me.data?.userId ? (
          <>
            <RowDivider inset={16} />
            <ListRow
              title="Delete group permanently"
              destructive
              onPress={() =>
                Alert.alert(
                  "Delete group permanently?",
                  "The group and all of its expense history will be erased. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        deleteGroup.mutate({
                          groupId: id,
                          expectedVersion: group!.version,
                        }),
                    },
                  ],
                )
              }
            />
          </>
        ) : null}
      </Section>
      {update.error ? <ErrorState message={update.error.message} /> : null}
      {removeMember.error ? <ErrorState message={removeMember.error.message} /> : null}
      {leave.error ? <ErrorState message={leave.error.message} /> : null}
      {archive.error ? <ErrorState message={archive.error.message} /> : null}
      {createInvite.error ? <ErrorState message={createInvite.error.message} /> : null}
      {deleteGroup.error ? <ErrorState message={deleteGroup.error.message} /> : null}
    </Screen>
  );
}
