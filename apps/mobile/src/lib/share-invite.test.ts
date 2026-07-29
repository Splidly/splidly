import { getInviteShareContent } from "./share-invite";

const inviteUrl = "https://splidly.example.com/invite/example";

describe("getInviteShareContent", () => {
  it("shares only the plain URL text", () => {
    expect(getInviteShareContent(inviteUrl)).toEqual({
      message: inviteUrl,
    });
  });
});
