
import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  ScrollView,
  ActivityIndicator,
  View,
  Alert,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { Title, Paragraph, Button as PaperButton, RadioButton, Divider } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { MyUserContext } from '../../configs/MyContexts';
import { useNavigation } from '@react-navigation/native';
import Apis, { authApis, endpoints } from '../../configs/Apis';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const BookTicket = ({ route }) => {
  const { eventId } = route.params;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState('');
  const [discounts, setDiscounts] = useState([]);
  const [discountApplied, setDiscountApplied] = useState(null);
  const [booking, setBooking] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // Trạng thái thanh toán
  const [paymentMethod, setPaymentMethod] = useState('MoMo');
  const user = useContext(MyUserContext);
  const navigation = useNavigation();

  // Hàm tải thông tin sự kiện
  const loadEvent = useCallback(async () => {
    try {
      const res = await Apis.get(endpoints.eventDetail(eventId));
      setEvent(res.data);
    } catch (ex) {
      console.error('Error loading event:', ex);
      Alert.alert('Lỗi', 'Không thể tải thông tin sự kiện.');
      setEvent(null);
    }
  }, [eventId]);

  // Hàm tải danh sách vé
  const loadTickets = useCallback(async () => {
    try {
      const res = await Apis.get(endpoints.ticketsOfEvent(eventId));
      setTickets(res.data);
      if (res.data.length > 0) setSelectedTicket(res.data[0].id);
    } catch (ex) {
      console.error('Error loading tickets:', ex);
      Alert.alert('Lỗi', 'Không thể tải danh sách vé.');
    }
  }, [eventId]);

  // Hàm tải danh sách mã giảm giá
  const loadDiscounts = useCallback(async (token) => {
    try {
      const res = await authApis(token).get(endpoints.discounts(eventId));
      setDiscounts(res.data.discounts || []);
    } catch (ex) {
      console.error('Error loading discounts:', ex);
      Alert.alert('Lỗi', 'Không thể tải mã giảm giá.');
    }
  }, [eventId]);

  // Hàm áp dụng mã giảm giá
  const applyDiscount = useCallback(async (code) => {
    setDiscount(code);
    if (!code) {
      setDiscountApplied(null);
      return;
    }
    try {
      const token = user?.access_token || (await AsyncStorage.getItem('token'));
      const res = await authApis(token).get(endpoints.discountsCheck(eventId), {
        params: { discount_code: code },
      });
      if (res.data) {
        setDiscountApplied(res.data);
        Alert.alert('Thành công', `Mã giảm giá ${code} đã được áp dụng: Giảm ${res.data.discount_percent}%`);
      } else {
        setDiscountApplied(null);
        Alert.alert('Lỗi', 'Mã giảm giá không hợp lệ hoặc không áp dụng cho sự kiện này.');
      }
    } catch (ex) {
      console.error('Error applying discount:', ex);
      setDiscountApplied(null);
      Alert.alert('Lỗi', 'Không thể áp dụng mã giảm giá.');
    }
  }, [eventId, user]);

  // Hàm kiểm tra trạng thái đơn hàng
  const checkOrderStatus = useCallback(async (token, orderId) => {
    try {
      const res = await authApis(token).get(`orders/${orderId}/`);
      if (res.data.status === 'PAID') {
        setPaymentStatus('success');
        Alert.alert('Thành công', 'Thanh toán thành công! Vé của bạn đã được đặt.');
        navigation.navigate('MyTickets'); // Điều hướng đến màn hình vé của tôi
      } else if (res.data.status === 'FAILED') {
        setPaymentStatus('failed');
        Alert.alert('Thất bại', 'Thanh toán không thành công. Vui lòng thử lại.');
      } else {
        setPaymentStatus('pending');
      }
    } catch (ex) {
      console.error('Error checking order status:', ex);
      Alert.alert('Lỗi', 'Không thể kiểm tra trạng thái thanh toán.');
    }
  }, [navigation]);

  // Hàm đặt vé (gọi createOrder và payOrder, sau đó mở payUrl)
  const handleBookTicket = useCallback(async () => {
    if (!selectedTicket) {
      Alert.alert('Lỗi', 'Vui lòng chọn loại vé!');
      return;
    }
    setBooking(true);
    try {
      const token = user?.access_token || (await AsyncStorage.getItem('token'));
      // Bước 1: Tạo đơn hàng
      const orderRes = await authApis(token).post(endpoints.createOrder(eventId), {
        ticket_id: selectedTicket,
        quantity: quantity,
        payment_method: paymentMethod,
        discount_code: discount || undefined,
      });
      const newOrderId = orderRes.data.order_id;
      setOrderId(newOrderId);

      // Bước 2: Thanh toán đơn hàng
      const payRes = await authApis(token).post(endpoints.payOrder(newOrderId));
      const payUrl = payRes.data.payUrl;

      if (!payUrl) {
        throw new Error('Không nhận được payUrl từ server.');
      }

      // Bước 3: Kiểm tra xem có thể mở MoMo không (nếu payUrl là deep link)
      const isMomoDeepLink = payUrl.startsWith('momo://');
      let canOpen = true;

      if (isMomoDeepLink) {
        canOpen = await Linking.canOpenURL(payUrl);
      }

      if (canOpen) {
        // Mở payUrl để chuyển hướng đến MoMo hoặc trang web thanh toán
        await Linking.openURL(payUrl);
        Alert.alert('Thông báo', 'Vui lòng hoàn tất thanh toán trên MoMo. Sau khi thanh toán, hệ thống sẽ kiểm tra trạng thái.');

        // Bước 4: Kiểm tra trạng thái đơn hàng sau khi người dùng thanh toán
        setTimeout(() => {
          checkOrderStatus(token, newOrderId);
        }, 5000); // Chờ 5 giây để người dùng hoàn tất thanh toán
      } else {
        // Fallback nếu không mở được MoMo
        Alert.alert(
          'Thông báo',
          'Ứng dụng MoMo chưa được cài đặt. Vui lòng cài đặt MoMo hoặc chọn phương thức thanh toán khác.',
          [
            {
              text: 'Cài đặt MoMo',
              onPress: () => {
                const momoStoreUrl =
                  Platform.OS === 'ios'
                    ? 'https://apps.apple.com/app/momo/id931935235'
                    : 'https://play.google.com/store/apps/details?id=com.momo.app';
                Linking.openURL(momoStoreUrl);
              },
            },
            { text: 'Hủy', style: 'cancel' },
          ]
        );
      }
    } catch (ex) {
      console.error('Error booking ticket:', ex);
      Alert.alert('Lỗi', 'Đặt vé hoặc thanh toán thất bại!');
    } finally {
      setBooking(false);
    }
  }, [selectedTicket, quantity, paymentMethod, discount, eventId, user, checkOrderStatus]);

  // Tải dữ liệu ban đầu
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const token = user?.access_token || (await AsyncStorage.getItem('token'));
        await Promise.all([loadEvent(), loadTickets(), loadDiscounts(token)]);
      } catch (ex) {
        console.error('Error loading initial data:', ex);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [loadEvent, loadTickets, loadDiscounts, user]);

  const selectedTicketData = tickets.find((ticket) => ticket.id === selectedTicket);
  const ticketPrice = selectedTicketData ? selectedTicketData.price : 0;
  const subtotal = ticketPrice * quantity;
  const discountAmount = discountApplied ? (subtotal * discountApplied.discount_percent) / 100 : 0;
  const total = subtotal - discountAmount;

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!event) return <Paragraph style={{ margin: 20, color: 'red' }}>Không tìm thấy sự kiện.</Paragraph>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Thông tin sự kiện */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="calendar" size={24} color="#A49393" />
            <Title style={styles.sectionTitle}>Thông tin sự kiện</Title>
          </View>
          <Text style={styles.eventText}><Text style={styles.label}>Sự kiện:</Text> {event.name}</Text>
          <Text style={styles.eventText}><Text style={styles.label}>Ngày:</Text> {new Date(event.date).toLocaleString()}</Text>
          <Text style={styles.eventText}><Text style={styles.label}>Địa điểm:</Text> {event.location}</Text>
          <Text style={styles.eventText}><Text style={styles.label}>Mô tả:</Text> {event.description}</Text>
        </View>

        <Divider style={styles.divider} />

        {/* Chọn loại vé */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="ticket" size={24} color="#A49393" />
            <Title style={styles.sectionTitle}>Chọn loại vé</Title>
          </View>
          <RadioButton.Group onValueChange={setSelectedTicket} value={selectedTicket}>
            {tickets.map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                style={styles.ticketOption}
                onPress={() => setSelectedTicket(ticket.id)}
              >
                <RadioButton value={ticket.id} color="#A49393" />
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketText}>{ticket.type}</Text>
                  <Text style={styles.ticketPrice}>{ticket.price.toLocaleString('vi-VN')} VNĐ</Text>
                  <Text style={styles.ticketQuantity}>Còn {ticket.quantity} vé</Text>
                </View>
              </TouchableOpacity>
            ))}
          </RadioButton.Group>
        </View>

        <Divider style={styles.divider} />

        {/* Chọn số lượng vé */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="numeric" size={24} color="#A49393" />
            <Title style={styles.sectionTitle}>Số lượng vé</Title>
          </View>
          <View style={styles.quantitySelector}>
            <TouchableOpacity
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              style={styles.quantityButton}
            >
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              onPress={() => setQuantity(quantity + 1)}
              style={styles.quantityButton}
              disabled={selectedTicketData && quantity >= selectedTicketData.quantity}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Mã giảm giá với dropdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="sale" size={24} color="#A49393" />
            <Title style={styles.sectionTitle}>Mã giảm giá</Title>
          </View>
          <View style={styles.discountContainer}>
            <Picker
              selectedValue={discount}
              onValueChange={(itemValue) => applyDiscount(itemValue)}
              style={styles.discountInput}
              enabled={discounts.length > 0}
            >
              <Picker.Item label="Chọn mã giảm giá" value="" />
              {discounts.map((d) => (
                <Picker.Item
                  key={d.id}
                  label={`${d.code} (${d.discount_percent}%${d.target_rank !== 'none' ? ` - ${d.target_rank}` : ''})`}
                  value={d.code}
                  enabled={d.is_usable}
                  style={d.is_usable ? styles.pickerItem : styles.pickerItemDisabled}
                />
              ))}
            </Picker>
          </View>
          {discountApplied && (
            <Text style={styles.discountAppliedText}>
              Đã áp dụng: Giảm {discountApplied.discount_percent}% (Tiết kiệm: {discountAmount.toLocaleString('vi-VN')} VNĐ)
            </Text>
          )}
        </View>

        <Divider style={styles.divider} />

        {/* Phương thức thanh toán */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="credit-card" size={24} color="#A49393" />
            <Title style={styles.sectionTitle}>Phương thức thanh toán</Title>
          </View>
          <RadioButton.Group onValueChange={setPaymentMethod} value={paymentMethod}>
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod('MoMo')}
            >
              <RadioButton value="MoMo" color="#A49393" />
              <Text style={styles.paymentText}>MoMo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod('VNPAY')}
            >
              <RadioButton value="VNPAY" color="#A49393" />
              <Text style={styles.paymentText}>VNPAY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => setPaymentMethod('FAKE')}
            >
              <RadioButton value="FAKE" color="#A49393" />
              <Text style={styles.paymentText}>Thanh toán (test)</Text>
            </TouchableOpacity>
          </RadioButton.Group>
        </View>

        <Divider style={styles.divider} />

        {/* Tổng tiền */}
        <View style={styles.section}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tạm tính:</Text>
            <Text style={styles.totalValue}>{subtotal.toLocaleString('vi-VN')} VNĐ</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Giảm giá:</Text>
              <Text style={styles.totalValue}>-{discountAmount.toLocaleString('vi-VN')} VNĐ</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng:</Text>
            <Text style={styles.totalAmount}>{total.toLocaleString('vi-VN')} VNĐ</Text>
          </View>
        </View>

        {/* Hiển thị trạng thái thanh toán (nếu có) */}
        {paymentStatus === 'pending' && (
          <View style={styles.section}>
            <Text style={styles.paymentStatusText}>Đang chờ thanh toán...</Text>
          </View>
        )}
      </ScrollView>

      {/* Nút đặt vé cố định */}
      <View style={styles.fixedButtonContainer}>
        <PaperButton
          mode="contained"
          onPress={handleBookTicket}
          loading={booking}
          disabled={booking}
          style={styles.bookButton}
          labelStyle={styles.bookButtonLabel}
        >
          Đặt vé ({total.toLocaleString('vi-VN')} VNĐ)
        </PaperButton>
      </View>
    </View>
  );

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    padding: 16,
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  eventText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 4,
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
  },
  ticketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketText: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  ticketPrice: {
    fontSize: 16,
    color: '#FF5722',
    fontWeight: 'bold',
    marginVertical: 2,
  },
  ticketQuantity: {
    fontSize: 14,
    color: '#666',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  quantityButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    color: '#333',
  },
  discountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  discountInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#A49393',
    borderRadius: 4,
    height: 40,
  },
  pickerItem: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemDisabled: {
    fontSize: 16,
    color: '#999',
  },
  discountAppliedText: {
    marginTop: 8,
    color: '#4CAF50',
    fontSize: 14,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentText: {
    fontSize: 16,
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#555',
  },
  totalValue: {
    fontSize: 16,
    color: '#555',
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 18,
    color: '#FF5722',
    fontWeight: 'bold',
  },
  paymentStatusText: {
    fontSize: 16,
    color: '#FFA500',
    textAlign: 'center',
  },
  divider: {
    backgroundColor: '#E0E0E0',
    height: 1,
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  bookButton: {
    backgroundColor: '#FF5722',
    borderRadius: 8,
    paddingVertical: 12,
  },
  bookButtonLabel: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default BookTicket;
