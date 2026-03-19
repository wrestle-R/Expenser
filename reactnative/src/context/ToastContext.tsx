import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from './ThemeContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

const toastConfig: Record<
  ToastType,
  {icon: string; lightColor: string; darkColor: string}
> = {
  success: {icon: 'checkmark-circle', lightColor: '#22c55e', darkColor: '#4ade80'},
  error: {icon: 'alert-circle', lightColor: '#ef4444', darkColor: '#f87171'},
  info: {icon: 'information-circle', lightColor: '#3b82f6', darkColor: '#60a5fa'},
  warning: {icon: 'warning', lightColor: '#f59e0b', darkColor: '#fbbf24'},
};

export function ToastProvider({children}: {children: React.ReactNode}) {
  const {isDark, colors} = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const animValues = useRef<Map<string, Animated.Value>>(new Map()).current;

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}_${Math.random()}`;
      const animValue = new Animated.Value(0);
      animValues.set(id, animValue);

      setToasts(prev => [...prev, {id, message, type}]);

      Animated.sequence([
        Animated.spring(animValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.delay(2500),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        animValues.delete(id);
      });
    },
    [animValues],
  );

  const dismissToast = useCallback(
    (id: string) => {
      const animValue = animValues.get(id);
      if (animValue) {
        Animated.timing(animValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
          animValues.delete(id);
        });
      }
    },
    [animValues],
  );

  return (
    <ToastContext.Provider value={{showToast}}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map(toast => {
          const animValue = animValues.get(toast.id);
          if (!animValue) return null;

          const config = toastConfig[toast.type];
          const accentColor = isDark ? config.darkColor : config.lightColor;

          return (
            <Animated.View
              key={toast.id}
              style={[
                styles.toast,
                {
                  backgroundColor: isDark
                    ? 'rgba(37, 37, 64, 0.98)'
                    : 'rgba(255, 255, 255, 0.98)',
                  borderLeftColor: accentColor,
                  shadowColor: '#000',
                  transform: [
                    {
                      translateY: animValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-80, 0],
                      }),
                    },
                  ],
                  opacity: animValue,
                },
              ]}>
              <Icon name={config.icon} size={22} color={accentColor} />
              <Text
                style={[styles.toastText, {color: colors.text}]}
                numberOfLines={2}>
                {toast.message}
              </Text>
              <TouchableOpacity
                onPress={() => dismissToast(toast.id)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
    marginBottom: 8,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
