/**
 * Lightweight User-Agent OS parser
 */
function parseOS(userAgentStr) {
  if (!userAgentStr) return 'Unknown';
  const ua = userAgentStr.toLowerCase();

  if (ua.includes('win')) return 'Windows';
  if (ua.includes('mac')) return 'macOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iOS';
  if (ua.includes('linux')) return 'Linux';

  return 'Unknown';
}

module.exports = { parseOS };
