export type Authorizer = {
  isAllowed(userId: number | undefined): boolean;
  register(userId: number): boolean;
  allowedUserIds(): number[];
};

export function createAuthorizer(allowedUserIds: number[]): Authorizer {
  const allowed = new Set(allowedUserIds);

  return {
    isAllowed(userId) {
      return typeof userId === "number" && allowed.has(userId);
    },
    register(userId) {
      if (allowed.has(userId)) return false;
      allowed.add(userId);
      return true;
    },
    allowedUserIds() {
      return Array.from(allowed).sort((left, right) => left - right);
    }
  };
}
