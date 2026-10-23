module.exports = {
  expo: {
    name: 'Expenser Lite', slug: 'expenser-lite', version: '1.0.0',
    orientation: 'portrait', scheme: 'expenser-lite', userInterfaceStyle: 'automatic', newArchEnabled: true,
    icon: '../expo/assets/images/icon.png',
    android: {
      package: 'com.rdp.expenser.lite', edgeToEdgeEnabled: true,
      adaptiveIcon: { foregroundImage: '../expo/assets/images/android-icon-foreground.png', monochromeImage: '../expo/assets/images/android-icon-monochrome.png', backgroundColor: '#f4f4f5' },
    },
    plugins: [
      './plugins/with-shared-source',
      '../expo/plugins/with-storage-capacity',
      ['expo-splash-screen', { image: '../expo/assets/images/splash-icon.png', imageWidth: 144, resizeMode: 'contain', backgroundColor: '#f4f4f5', dark: { backgroundColor: '#292929', image: '../expo/assets/images/splash-icon.png' } }],
      ['expo-build-properties', { android: { buildArchs: ['arm64-v8a', 'armeabi-v7a'], enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true, useLegacyPackaging: true, enablePngCrunchInReleaseBuilds: true } }],
      ['expo-notifications', { icon: '../expo/assets/images/notification-icon.png', color: '#666666' }],
    ],
  },
};
