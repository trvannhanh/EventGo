import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image } from 'react-native';
import { Button, Surface, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MyUserContext } from '../../configs/MyContexts';
import Apis, { endpoints } from '../../configs/Apis';
import { COLORS } from '../../components/styles/MyStyles';

const MyTickets = () => {
  const user = useContext(MyUserContext);
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId } = route.params; // Lấy orderId từ navigation
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false); // Khởi tạo loading = false
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    console.log('MyTickets mounted, orderId:', orderId);
    return () => {
      isMounted.current = false;
      console.log('MyTickets unmounted');
    };
  }, []);

  const fetchTickets = useCallback(async () => {
    if (refreshing || !isMounted.current) {
      console.log('Bỏ qua fetchTickets: refreshing=', refreshing, 'isMounted=', isMounted.current);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`Gọi API: orderId=${orderId}, time=${new Date().toISOString()}`);

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (isMounted.current) {
          setError('Vui lòng đăng nhập để xem vé');
        }
        console.log('Không tìm thấy token, thoát fetchTickets');
        return;
      }

      const url = `${endpoints['orders']}${orderId}/details/`;
      console.log('URL API:', url);
      const response = await Apis.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Response data:', JSON.stringify(response.data, null, 2));
      const newTickets = Array.isArray(response.data.results) ? response.data.results : [];
      if (newTickets.length === 0) {
        console.log('Không có vé trong results');
      }
      if (isMounted.current) {
        setTickets(newTickets);
        setRefreshing(false);
      }
    } catch (error) {
      console.error('Lỗi khi tải vé:', error.message, error.stack);
      if (isMounted.current) {
        setError('Không thể tải danh sách vé. Vui lòng thử lại.');
        setRefreshing(false);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        console.log('fetchTickets hoàn tất, loading=', false);
      }
    }
  }, [orderId]);

  const onRefresh = useCallback(() => {
    if (loading || refreshing) {
      console.log('Bỏ qua onRefresh: loading=', loading, 'refreshing=', refreshing);
      return;
    }
    console.log('Làm mới thủ công');
    setRefreshing(true);
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    console.log('useEffect chạy, orderId:', orderId);
    fetchTickets();
  }, [fetchTickets]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Chưa check-in';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
  }, []);

  const renderTicketItem = useCallback(
    ({ item }) => {
      const qrImage = item.qr_image ? `http://res.cloudinary.com/dqpkxxzaf/${item.qr_image}` : 'https://via.placeholder.com/300?text=No+QR+Image';
      const eventName = item.ticket?.event?.name || 'Chưa xác định';
      const ticketType = item.ticket?.type || 'Chưa xác định';

      return (
        <Surface style={[styles.ticketCard, { elevation: 2 }]}>
          <View style={styles.ticketCardContent}>
            <Image source={{ uri: qrImage }} style={styles.qrImage} resizeMode="contain" />
            <View style={styles.ticketDetails}>
              <Text style={styles.ticketTitle}>Vé #{item.qr_code}</Text>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Sự kiện:</Text>
                <Text style={styles.ticketValue}>{eventName}</Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Loại vé:</Text>
                <Text style={styles.ticketValue}>{ticketType}</Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Trạng thái:</Text>
                <Text style={[styles.ticketValue, { color: item.checked_in ? COLORS.success : COLORS.error }]}>
                  {item.checked_in ? 'Đã check-in' : 'Chưa check-in'}
                </Text>
              </View>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketLabel}>Thời gian check-in:</Text>
                <Text style={styles.ticketValue}>{formatDate(item.checkin_time)}</Text>
              </View>
            </View>
          </View>
        </Surface>
      );
    },
    [formatDate]
  );

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="ticket-outline" size={80} color={COLORS.primary} />
      <Text style={styles.emptyText}>Không có vé nào cho đơn hàng #{orderId}</Text>
    </View>
  ), [orderId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Danh sách vé - Đơn hàng #{orderId}</Text>
        <Text style={styles.subtitle}>Xem thông tin vé của bạn</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách vé...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={24} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={onRefresh} style={styles.retryButton}>
            Thử lại
          </Button>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTicketItem}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    flex: 1,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    flex: 1,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  ticketCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  ticketCardContent: {
    borderRadius: 12,
    overflow: 'hidden',
    padding: 16,
  },
  qrImage: {
    width: '100%',
    height: 300, // Tăng kích thước QR lên 300
    borderRadius: 8,
    marginBottom: 16,
  },
  ticketDetails: {
    padding: 8,
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ticketLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  ticketValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default MyTickets;