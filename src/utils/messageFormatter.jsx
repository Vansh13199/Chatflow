/**
 * Formats a unix timestamp or Date object into a readable time string.
 * @param {number|Date} timestamp
 * @returns {string} e.g., "10:45 AM"
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};