import { router } from "./trpc";
import { currencyRouter } from "./routers/currency";
import { expensesRouter } from "./routers/expenses";
import { friendsRouter } from "./routers/friends";
import { groupsRouter } from "./routers/groups";
import { invitesRouter } from "./routers/invites";
import { profileRouter } from "./routers/profile";
import { pushRouter } from "./routers/push";
import { settlementsRouter } from "./routers/settlements";

export const appRouter = router({
  profile: profileRouter,
  push: pushRouter,
  friends: friendsRouter,
  groups: groupsRouter,
  invites: invitesRouter,
  currency: currencyRouter,
  expenses: expensesRouter,
  settlements: settlementsRouter,
});

export type AppRouter = typeof appRouter;
