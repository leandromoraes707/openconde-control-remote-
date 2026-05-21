export type Authorizer = {
  isAllowed(userId: number | undefined): boolean;
  register(userId: number): void;
};

export function createAuthorizer(allowedUserIds: number[]): Authorizer {
  const allowed = new Set(allowedUserIds);

  return {
    isAllowed(userId) {
      return typeof userId === "number" && allowed.has(userId);
    },
    register(userId) {
      if (!allowed.has(userId)) {
        allowed.add(userId);
      }
    }
  };
}
