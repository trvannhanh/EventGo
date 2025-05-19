import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Linking, SafeAreaView } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { ActivityIndicator, Button } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Apis, { authApis, endpoints } from '../../configs/Apis';
import { COLORS } from '../styles/MyStyles';

const CheckIn = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const navigation = useNavigation();
  const route = useRoute();
  const { eventId } = route.params || {};
  const device = useCameraDevice('back');
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    }
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const status = await Camera.requestCameraPermission();
        console.log('Trạng thái quyền camera:', status);
        setHasPermission(status === 'granted');
        
        if (status !== 'granted') {
          Alert.alert(
            'Cần quyền camera',
            'Ứng dụng cần quyền truy cập camera để quét mã QR check-in.',
            [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Mở cài đặt', onPress: () => Linking.openSettings() }
            ]
          );
        }
      } catch (error) {
        console.error('Lỗi khi yêu cầu quyền camera:', error);
        Alert.alert('Lỗi', 'Không thể truy cập camera. Vui lòng thử lại sau.');
      }
    })();
    
    return () => {
      // Cleanup when component unmounts
      setScanned(true);
    };
  }, []);
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: async (codes) => {
      if (scanned || loading) return;
      
      const qrCode = codes[0]?.value;
      if (qrCode) {
        setScanned(true);
        setLoading(true);
        setScanCount(prev => prev + 1);
        console.log('Mã QR quét được:', qrCode, 'cho eventId:', eventId);
        await checkInTicket(qrCode);
      }
    },
  });
  const checkInTicket = async (qrCode) => {
    try {
      if (!eventId) {
        Alert.alert('Lỗi', 'Không tìm thấy ID sự kiện! Vui lòng thử lại.');
        return;
      }
      
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token xác thực. Vui lòng đăng nhập lại!');
        navigation.navigate('login');
        return;
      }
      
      // Show an alert that we're processing the check-in
      console.log(`Đang xử lý check-in với mã QR: ${qrCode} cho sự kiện ID: ${eventId}`);
      
      const res = await authApis(token).post(endpoints.checkInTicket(eventId), {
        qr_code: qrCode,
      });
      
      if (res.status === 200) {
        if (res.data.message === 'Check-in thành công') {
          Alert.alert(
            'Thành công', 
            `Check-in thành công!\nOrder ID: ${res.data.order_id}\nAttendee: ${res.data.attendee_name || 'Không có tên'}`, 
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else if (res.data.message === 'Vé đã được check-in trước đó') {
          Alert.alert(
            'Thông báo', 
            `Vé đã được check-in trước đó!\nAttendee: ${res.data.attendee_name || 'Không có tên'}\nCheck-in time: ${res.data.checkin_time || 'Không rõ'}`,
            [{ text: 'OK', onPress: () => setScanned(false) }]
          );
        }
      }    } catch (ex) {
      const errorMessage = ex.response?.data?.error || 'Có lỗi xảy ra, vui lòng thử lại!';
      const status = ex.response?.status;
      
      if (status === 400) {
        Alert.alert('Lỗi', errorMessage, [
          { text: 'OK', onPress: () => setScanned(false) }
        ]);
      } else if (status === 404) {
        Alert.alert('Lỗi', 'Không tìm thấy vé với mã QR này! Vui lòng kiểm tra lại.', [
          { text: 'OK', onPress: () => setScanned(false) }
        ]);
      } else if (status === 401) {
        Alert.alert('Lỗi xác thực', 'Token không hợp lệ hoặc hết hạn! Vui lòng đăng nhập lại.', [
          { text: 'Đăng nhập', onPress: () => navigation.navigate('login') },
          { text: 'Hủy', onPress: () => setScanned(false), style: 'cancel' }
        ]);
      } else {
        Alert.alert('Lỗi', errorMessage, [
          { text: 'OK', onPress: () => setScanned(false) }
        ]);
      }
      console.error('Lỗi khi check-in:', ex);
    } finally {
      setLoading(false);
      // Allow scanning again after a short delay
      setTimeout(() => {
        if (isMounted.current) {
          setScanned(false);
        }
      }, 2000);
    }
  };
  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <MaterialCommunityIcons name="camera" size={60} color={COLORS.primary} />
        <Text style={styles.text}>Đang yêu cầu quyền truy cập camera...</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.centered}>
        <MaterialCommunityIcons name="camera-off" size={60} color={COLORS.error} />
        <Text style={styles.text}>Không có quyền truy cập camera!</Text>
        <Text style={styles.subText}>
          Ứng dụng cần quyền truy cập camera để quét mã QR check-in.
        </Text>
        <Button
          mode="contained"
          style={styles.button}
          icon="camera"
          onPress={async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === 'granted');
          }}
        >
          Yêu cầu lại quyền
        </Button>
        <Button
          mode="outlined"
          style={[styles.button, { marginTop: 10 }]}
          icon="cog"
          onPress={() => Linking.openSettings()}
        >
          Mở cài đặt
        </Button>
        <Button
          mode="text"
          style={{ marginTop: 20 }}
          icon="arrow-left"
          onPress={() => navigation.goBack()}
        >
          Quay lại
        </Button>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.centered}>
        <MaterialCommunityIcons name="camera-off" size={60} color={COLORS.error} />
        <Text style={styles.text}>Không tìm thấy camera trên thiết bị!</Text>
        <Button
          mode="contained"
          style={{ marginTop: 20 }}
          icon="arrow-left"
          onPress={() => navigation.goBack()}
        >
          Quay lại
        </Button>
      </SafeAreaView>
    );
  }
  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={!scanned || !loading}
        codeScanner={codeScanner}
      />
      
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.instructionText}>
          Đặt mã QR vào giữa khung hình để quét
        </Text>
        {scanCount > 0 && (
          <Text style={styles.scanCountText}>
            Đã quét: {scanCount} mã
          </Text>
        )}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang xử lý check-in...</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          icon="arrow-left"
          style={styles.navButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          Quay lại
        </Button>
        
        <Button
          mode="contained"
          icon="lightbulb-on"
          style={[styles.navButton, { backgroundColor: COLORS.warning }]}
          onPress={() => {
            // This is a placeholder for flashlight functionality
            Alert.alert('Thông báo', 'Chức năng bật đèn flash đang được phát triển');
          }}
          disabled={loading}
        >
          Đèn Flash
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 5,
    overflow: 'hidden',
  },
  scanCountText: {
    color: COLORS.primary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 2,
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  navButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 30,
    elevation: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  text: {
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    marginVertical: 10,
    width: '80%',
    alignSelf: 'center',
  },
});

export default CheckIn;