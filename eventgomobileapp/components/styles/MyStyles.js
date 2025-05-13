// filepath: d:\Study\CCNLTHD\CuoiKi\EventGo\EventGo\eventgomobileapp\components\styles\MyStyles.js
import { StyleSheet, Dimensions } from 'react-native';
import { DefaultTheme } from 'react-native-paper';

// Màu chủ đạo: tông tím hồng nhạt
export const COLORS = {
  primary: '#B085F5', // Tím hồng nhạt làm màu chính
  primaryLight: '#D8C4FF', // Tím hồng nhạt hơn
  secondary: '#FF92A5', // Hồng đậm
  secondaryLight: '#FFCAD4', // Hồng nhạt
  accent: '#7C4DFF', // Tím đậm
  background: '#FFFFFF', // Nền trắng
  surface: '#F8F8F8', // Bề mặt component
  text: '#333333', // Màu chữ chính
  textSecondary: '#666666', // Màu chữ phụ
  disabled: '#BBBBBB', // Màu disabled
  placeholder: '#999999', // Màu placeholder
  backdrop: 'rgba(0, 0, 0, 0.3)', // Màu overlay
  error: '#FF6B6B', // Màu báo lỗi
  errorLight: '#FFEDED', // Màu nền lỗi
  success: '#4CAF50', // Màu thành công
  successLight: '#E8F5E9', // Màu nền thành công
  warning: '#FFC107', // Màu cảnh báo
  warningLight: '#FFF8E1', // Màu nền cảnh báo
  info: '#2196F3', // Màu thông tin
  infoLight: '#E3F2FD', // Màu nền thông tin
  divider: '#EEEEEE', // Màu ngăn cách
  border: '#DDDDDD', // Màu viền
  shadow: '#000000', // Màu bóng đổ
  onPrimary: '#FFFFFF', // Màu chữ trên nền primary
  onSecondary: '#FFFFFF', // Màu chữ trên nền secondary
  lightPrimary: '#F0E6FF', // Màu nền nhạt cho các badge và chip
  lightSecondary: '#FFECEF', // Màu nền nhạt cho các badge và chip thứ cấp
  googleRed: '#DB4437', // Màu đỏ của Google
  facebookBlue: '#4267B2', // Màu xanh của Facebook
};

// Định nghĩa chủ đề cho ứng dụng
export const AppTheme = {
  ...DefaultTheme,
  dark: false,
  roundness: 15,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    accent: COLORS.accent,
    background: COLORS.background,
    surface: COLORS.surface,
    text: COLORS.text,
    disabled: COLORS.disabled,
    placeholder: COLORS.placeholder,
    backdrop: COLORS.backdrop,
    error: COLORS.error,
    notification: COLORS.secondary,
    onSurface: COLORS.text,
    onBackground: COLORS.text,
    border: COLORS.border,
  },
  fonts: {
    ...DefaultTheme.fonts,
    // Có thể tùy chỉnh fonts nếu cần
  },
  animation: {
    scale: 1.0,
  },
};

const { width, height } = Dimensions.get('window');

const MyStyles = StyleSheet.create({
  // Card Styles
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 15,
    borderWidth: 0,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardElevated: {
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 15,
    borderWidth: 0,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  
  // Typography
  title: {
    textAlign: 'center',
    marginBottom: 16,
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 24,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 12,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  text: {
    color: COLORS.text,
    fontSize: 14,
  },
  textSecondary: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  
  // Form Elements
  input: {
    marginBottom: 16,
    backgroundColor: COLORS.background,
  },
  label: {
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  // Avatar
  avatar: {
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: COLORS.primaryLight,
  },
  
  // Button Styles
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    margin: 8,
    paddingVertical: 8,
  },
  buttonSecondary: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    margin: 8,
    paddingVertical: 8,
  },
  buttonOutline: {
    borderColor: COLORS.primary,
    borderWidth: 1,
    backgroundColor: 'transparent',
    borderRadius: 15,
    margin: 8,
    paddingVertical: 8,
  },
  buttonText: {
    color: COLORS.background,
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  buttonTextOutline: {
    color: COLORS.primary,
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  
  // Helpers
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 16,
  },
  
  // Legacy styles for backward compatibility
  cardPastel: {
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 15,
    borderWidth: 0,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  titlePastel: {
    textAlign: 'center',
    marginBottom: 12,
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 24,
  },
  inputPastel: {
    marginBottom: 16,
    backgroundColor: COLORS.background,
  },
  iconPastel: {
    color: COLORS.secondary,
    marginBottom: 4,
  },
  labelPastel: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  textDark: {
    color: COLORS.text,
  },
  avatarPastel: {
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: COLORS.primaryLight,
  },
  buttonPastel: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    margin: 8,
  },
  buttonOutlinePastel: {
    borderColor: COLORS.primary,
  },
  buttonLabelLight: {
    color: COLORS.background,
    fontWeight: 'bold',
  },
  buttonLabelDark: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  
  // *** Shared styles from SharedStyles.js ***
  
  // Container styles
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  
  // Card styles from shared
  cardShared: {
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  
  // Form styles
  textInput: {
    height: 50,
    backgroundColor: COLORS.surface,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonStandard: {
    marginVertical: 8,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonTextPrimary: {
    color: COLORS.onPrimary,
  },
  buttonTextSecondary: {
    color: COLORS.primary,
  },
  
  // State styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginVertical: 24,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    backgroundColor: COLORS.errorLight,
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginVertical: 8,
  },
  
  // Badge styles
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
  },
  badgeText: {
    color: COLORS.onSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Fab styles
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
  },
});

export default MyStyles;
