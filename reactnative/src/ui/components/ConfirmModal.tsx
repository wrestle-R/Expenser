import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../context/ThemeContext';

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'destructive' | 'success';
  icon?: string;
  loading?: boolean;
}

export default function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  icon,
  loading = false,
}: ConfirmModalProps) {
  const {isDark, colors} = useTheme();

  const getConfirmButtonColor = () => {
    switch (confirmColor) {
      case 'destructive':
        return colors.error;
      case 'success':
        return colors.success;
      default:
        return colors.primary;
    }
  };

  const getConfirmButtonBg = () => {
    switch (confirmColor) {
      case 'destructive':
        return colors.errorBg;
      case 'success':
        return colors.successBg;
      default:
        return colors.primary + '15';
    }
  };

  const getIconColor = () => {
    switch (confirmColor) {
      case 'destructive':
        return colors.error;
      case 'success':
        return colors.success;
      default:
        return colors.primary;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? 'rgba(0, 0, 0, 0.7)'
                  : 'rgba(255, 255, 255, 0.7)',
              },
            ]}
          />
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark
                    ? 'rgba(30, 30, 40, 0.98)'
                    : 'rgba(255, 255, 255, 0.98)',
                  borderColor: colors.border,
                },
              ]}>
              {icon && (
                <View
                  style={[
                    styles.iconContainer,
                    {backgroundColor: getConfirmButtonBg()},
                  ]}>
                  <Icon name={icon} size={28} color={getIconColor()} />
                </View>
              )}

              <Text style={[styles.title, {color: colors.text}]}>{title}</Text>

              <Text style={[styles.message, {color: colors.textMuted}]}>
                {message}
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    {borderColor: colors.border},
                  ]}
                  onPress={onClose}
                  disabled={loading}>
                  <Text style={[styles.buttonText, {color: colors.text}]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    {backgroundColor: getConfirmButtonColor()},
                  ]}
                  onPress={onConfirm}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.buttonText, {color: '#fff'}]}>
                      {confirmText}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
