import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { Button, Surface, Chip, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { MyUserContext } from '../../configs/MyContexts';
import Apis, { endpoints } from '../../configs/Apis';
import { COLORS } from '../../components/styles/MyStyles';

const MyOrders = () => {
  const user = useContext(MyUserContext);
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [loadError, setLoadError] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchOrders = useCallback(async (status) => {
    if (!user) {
      setLoadError('Vui lòng đăng nhập để xem đơn hàng');
      setInitialLoading(false);
      return;
    }
    if (loading || refreshing || !isMounted.current) {
      console.log('Bỏ qua fetchOrders: loading=', loading, 'refreshing=', refreshing, 'isMounted=', isMounted.current);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      console.log(`Gọi API: payment_status=${status}, time=${new Date().toISOString()}`);

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        if (isMounted.current) {
          setLoadError('Vui lòng đăng nhập để xem đơn hàng');
        }
        return;
      }

      let url = `${endpoints['orders']}?payment_status=${status}`;
      const response = await Apis.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newOrders = Array.isArray(response.data.results) ? response.data.results : [];
      console.log(`Nhận được ${newOrders.length} đơn hàng`);
      if (isMounted.current) {
        setOrders(newOrders);
        setInitialLoading(false);
        setRefreshing(false);
      }
    } catch (error) {
      console.error('Lỗi khi tải đơn hàng:', error.response?.status, error.message);
      if (isMounted.current) {
        if (error.response?.status === 401) {
          setLoadError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          // Có thể dispatch action logout ở đây
        } else {
          setLoadError('Không thể tải đơn hàng. Vui lòng thử lại.');
        }
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const onRefresh = useCallback(() => {
    if (loading || refreshing) {
      console.log('Bỏ qua onRefresh: loading=', loading, 'refreshing=', refreshing);
      return;
    }
    console.log('Làm mới thủ công, activeTab:', activeTab);
    setRefreshing(true);
    fetchOrders(activeTab);
  }, [fetchOrders, activeTab]);

  useEffect(() => {
    console.log('useEffect chạy, activeTab:', activeTab);
    fetchOrders(activeTab);
  }, [activeTab, fetchOrders]);

  useEffect(() => {
    console.log('user thay đổi:', user);
  }, [user]);

  const formatDate = useCallback((dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
  }, []);

  const formatCurrency = useCallback((amount) => {
    return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
  }, []);

  const getStatusChip = useCallback((status) => {
    const chipStyles = {
      pending: { icon: 'clock-outline', bg: COLORS.warning, text: 'Chờ thanh toán' },
      paid: { icon: 'check-circle', bg: COLORS.success, text: 'Đã thanh toán' },
      failed: { icon: 'close-circle', bg: COLORS.error, text: 'Đã hủy' },
    };
    const { icon, bg, text } = chipStyles[status.toLowerCase()] || chipStyles.pending;
    return (
      <Chip
        icon={icon}
        style={[styles.statusChip, { backgroundColor: bg }]}
        textStyle={{ color: 'white' }}
      >
        {text}
      </Chip>
    );
  }, []);

  const renderOrderItem = useCallback(
    ({ item }) => {
      const imageUri = item.details[0]?.ticket?.event?.image || 'https://via.placeholder.com/300x200?text=No+Image';
      const eventId = item.details[0]?.ticket?.event?.id;
      // console.log('Rendering order item:', item.details[0], 'Event ID:', eventId);
      // console.log('Rendering ticket item:', item.details[0]?.ticket?.id, 'Event ID:', eventId);
      // console.log(item.details[0]?.ticket?.event?.name, 'Event ID:', eventId);

      return (
        <Surface style={[styles.orderCard, { elevation: 2 }]}>
          <View style={styles.orderCardContent}>
            <Image source={{ uri: imageUri }} style={styles.orderImage} resizeMode="cover" />
            {getStatusChip(item.payment_status)}
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderTitle}>Đơn hàng #{item.id}</Text>
                <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
              </View>
            </View>
            <View style={styles.orderDetails}>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Sự kiện:</Text>
                <Text style={styles.orderValue}>{item.details[0]?.ticket?.event?.name || 'Chưa xác định'}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Tổng tiền:</Text>
                <Text style={styles.orderValue}>{formatCurrency(item.total_amount)}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Số lượng vé:</Text>
                <Text style={styles.orderValue}>{item.quantity}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Phương thức:</Text>
                <Text style={styles.orderValue}>{item.payment_method}</Text>
              </View>
            </View>
            <Divider />
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                icon="information-outline"
                style={{ borderColor: COLORS.primary, marginVertical: 4 }}
                textColor={COLORS.primary}
                onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
              >
                Chi tiết
              </Button>
              {item.payment_status === 'paid' && (
                <Button
                  mode="contained"
                  icon="ticket"
                  style={{ backgroundColor: COLORS.success, marginVertical: 4 }}
                  onPress={() => 
                    navigation.navigate('home', {
                      screen: 'MyTickets',
                      params: { orderId: item.id },
                    })
                  }
                >
                  Xem vé
                </Button>

              )}

              {item.payment_status === 'paid' && (
                <Button
                  mode="contained"
                  icon="message"
                  style={{ backgroundColor: COLORS.success, marginVertical: 4 }}
                  onPress={() => 
                    navigation.navigate('home', {
                      screen: 'Chat',
                      params: { eventId: eventId },
                    })
                  }
                >
                  Chat
                </Button>

              )}
            </View>
          </View>
        </Surface>
      );
    },
    [navigation, formatDate, formatCurrency, getStatusChip]
  );

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="cart-off" size={80} color={COLORS.primary} />
      <Text style={styles.emptyText}>
        {activeTab === 'pending'
          ? 'Bạn chưa có đơn hàng chờ thanh toán'
          : activeTab === 'paid'
          ? 'Bạn chưa có đơn hàng đã thanh toán'
          : 'Bạn chưa có đơn hàng bị hủy'}
      </Text>
    </View>
  ), [activeTab]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Đơn hàng của tôi</Text>
        <Text style={styles.subtitle}>Xem lịch sử đơn hàng và vé của bạn</Text>
      </View>

      <View style={styles.tabsContainer}>
        {['pending', 'paid', 'failed'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              console.log('Chuyển tab:', tab);
              setActiveTab(tab);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'pending' ? 'Chờ thanh toán' : tab === 'paid' ? 'Đã thanh toán' : 'Đã hủy'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {initialLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 16, color: COLORS.textSecondary }}>Đang tải đơn hàng...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={24} color={COLORS.error} />
          <Text style={styles.errorText}>{loadError}</Text>
          <Button mode="contained" onPress={onRefresh} style={styles.retryButton}>
            Thử lại
          </Button>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrderItem}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={{ flexGrow: 1 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
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
  orderCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  orderCardContent: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  orderHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  orderDate: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  orderDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  orderValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusChip: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  orderImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  actionButtons: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
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
});

export default MyOrders;