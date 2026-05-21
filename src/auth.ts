export type Authorizer = {
  isAllowed(userId: number | undefined): boolean;
};

export function createAuthorizer(allowedUserIds: number[]): Authorizer {
  const allowed = new Set(allowedUserIds);

  return {
    isAllowed(userId) {
      return typeof userId === "number" && allowed.has(userId);
    }
  };
}
