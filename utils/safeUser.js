/**
 * Sérialisation d'un utilisateur pour les réponses API : jamais de hash de mot
 * de passe, d'identifiants de session ni de photo brute (Bytes). La photo se lit
 * via GET /users/:id/profile-image ; on n'expose que sa présence.
 */
function toSafeUser(user) {
  if (!user) return user;
  const { password, profileImage, currentSessionId, kioskSessionId, ...rest } = user;
  return { ...rest, hasProfileImage: profileImage != null };
}

module.exports = { toSafeUser };
