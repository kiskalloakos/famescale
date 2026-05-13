module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated requires its plugin to be listed LAST.
    plugins: ['react-native-reanimated/plugin'],
  };
};
