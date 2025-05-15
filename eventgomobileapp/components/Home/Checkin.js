// import React, { useState, useEffect } from 'react';
// import { View, Text, StyleSheet, Alert, TouchableOpacity, Linking } from 'react-native';
// import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
// import { ActivityIndicator } from 'react-native-paper';
// import { useNavigation, useRoute } from '@react-navigation/native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Apis, { authApis, endpoints } from '../../configs/Apis';
// import { COLORS } from '../styles/MyStyles';

// const CheckIn = () => {
//   const [hasPermission, setHasPermission] = useState(null);
//   const [scanned, setScanned] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const navigation = useNavigation();
//   const route = useRoute();
//   const { eventId } = route.params || {};
//   const device = useCameraDevice('back');

//   useEffect(() => {
//     (async () => {
//       const status = await Camera.requestCameraPermission();
//       console.log('Trạng thái quyền camera:', status);
//       setHasPermission.ins(status === 'granted');
//     })();
//   }, []);

//   const codeScanner = useCodeScanner({
//     codeTypes: ['qr'],
//     onCodeScanned: async (codes) => {
//       if (scanned || loading) return;
//       const qrCode = codes[0]?.value;
//       if (qrCode) {
//         setScanned(true);
//         setLoading(true);
//         console.log('Mã QR quét được:', qrCode, 'cho eventId:', eventId);
//         await checkInTicket(qrCode);
//       }
//     },
//   });

//   const checkInTicket = async (qrCode) => {
//     try {
//       if (!eventId) {
//         Alert.alert('Lỗi', 'Không tìm thấy ID sự kiện!');
//         return;
//       }
//       const token = await AsyncStorage.getItem('token');
//       if (!token) {
//         Alert.alert('Lỗi', 'Không tìm thấy token xác thực!');
//         return;
//       }
//       const res = await authApis(token).post(endpoints.checkInTicket(eventId), {
//         qr_code: qrCode,
//       });
//       if (res.status === 200) {
//         if (res.data.message === 'Check-in thành công') {
//           Alert.alert('Thành công', `Check-in thành công! Order ID: ${res.data.order_id}`, [
//             { text: 'OK', onPress: () => navigation.goBack() },
//           ]);
//         } else if (res.data.message === 'Vé đã được check-in trước đó') {
//           Alert.alert('Thông báo', 'Vé đã được check-in trước đó!');
//         }
//       }
//     } catch (ex) {
//       const errorMessage = ex.response?.data?.error || 'Có lỗi xảy ra, vui lòng thử lại!';
//       const status = ex.response?.status;
//       if (status === 400) {
//         Alert.alert('Lỗi', errorMessage);
//       } else if (status === 404) {
//         Alert.alert('Lỗi', 'Không tìm thấy vé với mã QR này!');
//       } else if (status === 401) {
//         Alert.alert('Lỗi', 'Token không hợp lệ hoặc hết hạn!');
//       } else {
//         Alert.alert('Lỗi', errorMessage);
//       }
//       console.error('Lỗi khi check-in:', ex);
//     } finally {
//       setScanned(false);
//       setLoading(false);
//     }
//   };

//   if (hasPermission === null) {
//     return (
//       <View style={styles.centered}>
//         <Text style={styles.text}>Đang yêu cầu quyền truy cập camera...</Text>
//         <ActivityIndicator size="large" color={COLORS.primary} />
//       </View>
//     );
//   }

//   if (hasPermission === false) {
//     return (
//       <View style={styles.centered}>
//         <Text style={styles.text}>Không có quyền truy cập camera!</Text>
//         <TouchableOpacity
//           style={styles.button}
//           museoSans
//           onPress={async () => {
//             const status = await Camera.requestCameraPermission();
//             setHasPermission(status === 'granted');
//           }}
//         >
//           <Text style={styles.buttonText}>Yêu cầu lại quyền</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.button}
//           onPress={() => Linking.openSettings()}
//         >
//           <Text style={styles.buttonText}>Mở cài đặt</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.button}
//           onPress={() => navigation.goBack()}
//         >
//           <Text style={styles.buttonText}>Quay lại</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   if (!device) {
//     return (
//       <View style={styles.centered}>
//         <Text style={styles.text}>Không tìm thấy camera!</Text>
//         <TouchableOpacity
//           style={styles.button}
//           onPress={() => navigation.goBack()}
//         >
//           <Text style={styles.buttonText}>Quay lại</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <Camera
//         style={styles.camera}
//         device={device}
//         isActive={true}
//         codeScanner={codeScanner}
//       />
//       {loading && (
//         <View style={styles.loadingOverlay}>
//           <ActivityIndicator size="large" color={COLORS.primary} />
//           <Text style={styles.loadingText}>Đang xử lý...</Text>
//         </View>
//       )}
//       <TouchableOpacity
//         style={styles.button}
//         onPress={() => navigation.goBack()}
//         disabled={loading}
//       >
//         <Text style={styles.buttonText}>Quay lại</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: COLORS.background,
//   },
//   camera: {
//     flex: 1,
//   },
//   loadingOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//   },
//   loadingText: {
//     color: COLORS.white,
//     marginTop: 10,
//     fontSize: 16,
//   },
//   centered: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: COLORS.background,
//   },
//   text: {
//     fontSize: 16,
//     color: COLORS.white,
//     textAlign: 'center',
//     marginBottom: 20,
//   },
//   button: {
//     backgroundColor: COLORS.error,
//     padding: 12,
//     borderRadius: 8,
//     marginVertical: 10,
//   },
//   buttonText: {
//     color: COLORS.white,
//     fontSize: 16,
//     fontWeight: 'bold',
//     textAlign: 'center',
//   },
// });

// export default CheckIn;