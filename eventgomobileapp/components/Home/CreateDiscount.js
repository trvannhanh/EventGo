import React, { useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { Button, ActivityIndicator, Divider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MyUserContext } from '../../configs/MyContexts';
import Apis, { endpoints } from '../../configs/Apis';
import { COLORS } from '../../components/styles/MyStyles';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const CreateDiscount = () => {
  const user = useContext(MyUserContext);
  const navigation = useNavigation();
  const route = useRoute();
  const { eventId } = route.params; // Lấy eventId từ navigation params

  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [expirationDate, setExpirationDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // Mặc định 7 ngày sau
  const [targetRank, setTargetRank] = useState('none'); // Mặc định là 'none'
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatDate = useCallback((date) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('vi-VN', options);
  }, []);

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || expirationDate;
    setShowDatePicker(false);
    setExpirationDate(currentDate);
  };

  const createDiscount = useCallback(async () => {
    if (!discountCode || !discountPercent) {
      setError('Vui lòng nhập đầy đủ mã giảm giá và phần trăm giảm giá.');
      return;
    }

    const percentValue = Number(discountPercent);
    if (isNaN(percentValue) || percentValue <= 0 || percentValue > 100) {
      setError('Phần trăm giảm giá phải là một số từ 1 đến 100.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setError('Vui lòng đăng nhập để tạo mã giảm giá.');
        return;
      }

      const url = `${endpoints['events']}${eventId}/create-discount/`;
      console.log('Gọi API tạo mã giảm giá:', url);

      const data = {
        code: discountCode,
        discount_percent: percentValue,
        expiration_date: expirationDate.toISOString(),
        target_rank: targetRank,
      };

      const response = await Apis.post(url, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Tạo mã giảm giá thành công:', response.data);
      Alert.alert('Thành công', 'Mã giảm giá đã được tạo thành công!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Lỗi khi tạo mã giảm giá:', error.response?.data || error.message);
      if (error.response?.status === 403) {
        setError('Bạn không có quyền tạo mã giảm giá cho sự kiện này.');
      } else if (error.response?.status === 400) {
        setError(error.response.data.error || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.');
      } else {
        setError('Không thể tạo mã giảm giá. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }, [discountCode, discountPercent, expirationDate, targetRank, eventId, navigation]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tạo mã giảm giá</Text>
        <Text style={styles.subtitle}>Tạo mã giảm giá cho sự kiện #{eventId}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Mã giảm giá</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập mã giảm giá (VD: DISCOUNT10)"
          placeholderTextColor={COLORS.textSecondary}
          value={discountCode}
          onChangeText={setDiscountCode}
        />

        <Text style={styles.label}>Phần trăm giảm giá (%)</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập phần trăm giảm giá (VD: 10)"
          placeholderTextColor={COLORS.textSecondary}
          value={discountPercent}
          onChangeText={setDiscountPercent}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Ngày hết hạn</Text>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>{formatDate(expirationDate)}</Text>
          <Button
            mode="outlined"
            onPress={() => setShowDatePicker(true)}
            style={styles.dateButton}
            textColor={COLORS.primary}
          >
            Chọn ngày
          </Button>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={expirationDate}
            mode="date"
            display="default"
            onChange={onChangeDate}
            minimumDate={new Date()} // Không cho phép chọn ngày trong quá khứ
          />
        )}

        <Text style={styles.label}>Hạng khách hàng áp dụng</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={targetRank}
            onValueChange={(itemValue) => setTargetRank(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Tất cả" value="none" />
            <Picker.Item label="Đồng (Bronze)" value="bronze" />
            <Picker.Item label="Bạc (Silver)" value="silver" />
            <Picker.Item label="Vàng (Gold)" value="gold" />
          </Picker>
        </View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <Divider style={{ marginVertical: 16 }} />

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <Button
            mode="contained"
            onPress={createDiscount}
            style={styles.submitButton}
            disabled={loading}
          >
            Tạo mã giảm giá
          </Button>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: COLORS.text,
    backgroundColor: 'white',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: 'white',
    overflow: 'hidden', // Ngăn Picker tràn ra ngoài
  },
  picker: {
    height: Platform.OS === 'ios' ? 150 : 50, // Tăng chiều cao trên iOS để hiển thị tốt hơn
    color: COLORS.text,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
  },
  dateButton: {
    borderColor: COLORS.primary,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    marginTop: 8,
  },
});

export default CreateDiscount;