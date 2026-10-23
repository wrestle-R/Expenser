const { withGradleProperties } = require('expo/config-plugins');
module.exports = (config) => withGradleProperties(config, (result) => {
  const properties = result.modResults;
  const current = properties.find((item) => item.type === 'property' && item.key === 'AsyncStorage_db_size_in_MB');
  if (current) current.value = '64';
  else properties.push({ type: 'property', key: 'AsyncStorage_db_size_in_MB', value: '64' });
  return result;
});
