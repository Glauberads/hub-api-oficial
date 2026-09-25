const requiredSecret = (name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be configured`);
  }
  return value;
};

export default {
  secret: requiredSecret("JWT_SECRET"),
  expiresIn: "8h",
  refreshSecret: requiredSecret("JWT_REFRESH_SECRET"),
  refreshExpiresIn: "30d"
};
