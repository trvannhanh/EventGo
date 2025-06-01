import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Image,
  TouchableOpacity,
  Linking,
} from "react-native";
import {
  Button,
  Surface,
  Chip,
  ActivityIndicator,
  Divider,
  FAB,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { MyUserContext } from "../../configs/MyContexts";
import Apis, { endpoints } from "../../configs/Apis";
import { COLORS } from "../../components/styles/MyStyles";

const MyEvents = () => {
  const user = useContext(MyUserContext);
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [loadError, setLoadError] = useState(null);
  const isMounted = useRef(true);
  // Add pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);

  useEffect(() => {
    console.log("Component mounted");
    isMounted.current = true;

    return () => {
      console.log("Component unmounting");
      isMounted.current = false;
    };
  }, []);

  const fetchEvents = useCallback(
    async (status, page = 1, shouldRefresh = false) => {
      console.log(
        `🔄 fetchEvents được gọi với status=${status}, page=${page}, loading=${loading}, refreshing=${refreshing}, isMounted=${isMounted.current}`
      );

      if (!isMounted.current) {
        console.log("Component unmounted, không gọi API");
        return;
      }

      if ((loading || refreshing) && !shouldRefresh) {
        console.log(
          `⏳ Đang tải dữ liệu, bỏ qua: loading=${loading}, refreshing=${refreshing}`
        );
        return;
      }

      try {
        console.log(
          `🚀 Bắt đầu tải sự kiện cho tab: ${status}, trang: ${page}`
        );
        setLoading(true);
        setLoadError(null);

        // Chỉ reset events khi đây là trang đầu tiên hoặc refresh
        if (page === 1 || shouldRefresh) {
          setEvents([]);
        }

        const token = await AsyncStorage.getItem("token");
        if (!token) {
          console.log("❌ Không tìm thấy token");
          setLoadError("Vui lòng đăng nhập để xem sự kiện");
          setLoading(false);
          setInitialLoading(false);
          setHasMoreEvents(false);
          return;
        }

        let url = `${endpoints["events"]}?organizer=me&status=${status}&page=${page}`;
        console.log(`📡 Gọi API: ${url}`);

        const response = await Apis.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Chỉ tiếp tục nếu component vẫn mounted
        if (!isMounted.current) {
          console.log(
            "Component unmounted sau khi gọi API, không cập nhật state"
          );
          return;
        }

        const newEvents = Array.isArray(response.data.results)
          ? response.data.results
          : [];
        console.log(
          `✅ Nhận được ${newEvents.length} sự kiện cho trạng thái "${status}" trang ${page}`
        );

        // Kiểm tra nếu đây là trang cuối cùng
        const hasNext = response.data.next !== null;
        setHasMoreEvents(hasNext);

        // Kiểm tra nếu có sự kiện không khớp với trạng thái hiện tại
        const matchingEvents = newEvents.filter(
          (event) => event.status === status
        );
        const mismatchedEvents = newEvents.filter(
          (event) => event.status !== status
        );

        if (mismatchedEvents.length > 0) {
          console.log(
            `⚠️ Phát hiện ${mismatchedEvents.length} sự kiện không khớp trạng thái:`
          );
          console.log(
            mismatchedEvents.map((e) => `${e.id}:${e.name}:${e.status}`)
          );
        }

        console.log(
          "Tất cả sự kiện nhận được:",
          newEvents.map((e) => `${e.id}:${e.name}:${e.status}`)
        );

        // Sắp xếp sự kiện theo ngày, mới nhất lên đầu
        const sortedEvents = [...matchingEvents].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );

        // Nối danh sách sự kiện mới vào danh sách cũ nếu đây không phải trang đầu tiên
        if (page === 1 || shouldRefresh) {
          setEvents(sortedEvents);
        } else {
          setEvents((prevEvents) => [...prevEvents, ...sortedEvents]);
        }

        // Cập nhật currentPage
        setCurrentPage(page);
        setInitialLoading(false);
      } catch (error) {
        console.error("❌ Lỗi khi tải sự kiện:", error.message);
        if (isMounted.current) {
          setLoadError("Không thể tải sự kiện. Vui lòng thử lại.");
          setHasMoreEvents(false);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  const onRefresh = useCallback(() => {
    console.log(`🔄 onRefresh được gọi, activeTab=${activeTab}`);
    setRefreshing(true);
    setCurrentPage(1); // Reset to first page
    fetchEvents(activeTab, 1, true);
  }, [activeTab, fetchEvents]);

  // Sử dụng useFocusEffect để tải lại dữ liệu khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      console.log(
        "🔍 Screen focused, reloading data for activeTab:",
        activeTab
      );
      setCurrentPage(1); // Reset to first page when screen gets focus
      fetchEvents(activeTab, 1);

      return () => {
        console.log("Screen unfocused");
      };
    }, [activeTab, fetchEvents])
  );

  // Cập nhật khi activeTab thay đổi
  useEffect(() => {
    console.log(`📑 Tab thay đổi: ${activeTab}`);
    setCurrentPage(1); // Reset to first page when tab changes
    setHasMoreEvents(true); // Reset hasMoreEvents flag
    fetchEvents(activeTab, 1);
  }, [activeTab, fetchEvents]);

  const formatDate = useCallback((dateString) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString("vi-VN", options);
  }, []);

  const getStatusChip = useCallback((status) => {
    const chipStyles = {
      upcoming: {
        icon: "calendar-clock",
        bg: COLORS.accent,
        text: "Sắp diễn ra",
      },
      ongoing: {
        icon: "calendar-today",
        bg: COLORS.success,
        text: "Đang diễn ra",
      },
      completed: {
        icon: "calendar-check",
        bg: COLORS.error,
        text: "Đã kết thúc",
      },
      canceled: {
        icon: "calendar-remove",
        bg: COLORS.textSecondary,
        text: "Đã hủy",
      },
    };
    const { icon, bg, text } = chipStyles[status] || chipStyles.upcoming;
    return (
      <Chip
        icon={icon}
        style={[styles.statusChip, { backgroundColor: bg }]}
        textStyle={{ color: "white" }}
      >
        {text}
      </Chip>
    );
  }, []);
  const renderEventItem = useCallback(
    ({ item }) => {
      console.log(
        `🎫 Render sự kiện ${item.id} - ${item.name}, status=${item.status}, activeTab=${activeTab}`
      );

      // Only show check-in button for ongoing and upcoming events
      const canCheckIn = ["ongoing", "upcoming"].includes(item.status);

      // For upcoming events, check if they're within 24 hours of start time to allow early check-in
      let isEarlyCheckIn = false;
      if (item.status === "upcoming" && item.date) {
        const eventDate = new Date(item.date);
        const now = new Date();
        const diffTime = eventDate - now;
        const diffHours = diffTime / (1000 * 60 * 60);
        isEarlyCheckIn = diffHours <= 24; // Check-in available within 24 hours before event
      }

      const canDiscount = ["ongoing", "upcoming"].includes(item.status);
      const imageUri =
        item.image || "https://via.placeholder.com/300x200?text=No+Image";

      return (
        <Surface style={[styles.eventCard, { elevation: 2 }]}>
          <View style={styles.eventCardContent}>
            <Image
              source={{ uri: imageUri }}
              style={styles.eventImage}
              resizeMode="cover"
            />
            {getStatusChip(item.status)}
            <View style={styles.eventHeader}>
              <View>
                <Text style={styles.eventTitle}>
                  {item.name || "Sự kiện không tên"}
                </Text>
                <Text style={styles.eventDate}>{formatDate(item.date)}</Text>
              </View>
            </View>
            <View style={styles.eventDetails}>
              <View style={styles.eventRow}>
                <Text style={styles.eventLabel}>Danh mục:</Text>
                <Text style={styles.eventValue}>
                  {item.category?.name || "Chưa xác định"}
                </Text>
              </View>
              <View style={styles.eventRow}>
                <Text style={styles.eventLabel}>Địa điểm:</Text>
                <Text style={styles.eventValue}>
                  {item.location || "Chưa cập nhật"}
                </Text>
              </View>
              <View style={styles.eventRow}>
                <Text style={styles.eventLabel}>Số vé khả dụng:</Text>
                <Text style={styles.eventValue}>
                  {item.ticket_limit || "Không giới hạn"}
                </Text>
              </View>
              <View style={styles.eventRow}>
                <Text style={styles.eventLabel}>Đánh giá trung bình:</Text>
                <Text style={styles.eventValue}>
                  {item.average_rating?.toFixed(1) || "0.0"} (
                  {item.review_count || 0} đánh giá)
                </Text>
              </View>
              <View style={styles.chipContainer}>
                <Chip
                  style={[
                    styles.chip,
                    { backgroundColor: COLORS.primaryLight },
                  ]}
                  textStyle={{ color: COLORS.primary }}
                >
                  {item.status.toUpperCase()}
                </Chip>
              </View>
            </View>
            <Divider />
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                icon="information-outline"
                style={{ borderColor: COLORS.primary, marginVertical: 4 }}
                textColor={COLORS.primary}
                onPress={() =>
                  navigation.navigate("home", {
                    screen: "EventDetail",
                    params: { eventId: item.id },
                  })
                }
              >
                Chi tiết
              </Button>
              <Button
                mode="contained"
                icon="google-maps"
                style={{ backgroundColor: COLORS.primary, marginVertical: 4 }}
                onPress={() => {
                  if (item.google_maps_link) {
                    Linking.openURL(item.google_maps_link);
                  } else {
                    alert("Không có thông tin địa điểm cho sự kiện này");
                  }
                }}
              >
                Chỉ đường
              </Button>
              {item.status === "upcoming" && (
                <Button
                  mode="contained"
                  icon="pencil-outline"
                  style={{ backgroundColor: COLORS.accent, marginVertical: 4 }} // Or another suitable color
                  onPress={() => {
                    navigation.navigate("Main", {
                      // Assuming CreateEvent is within the 'Main' stack, then 'home' tab
                      screen: "home",
                      params: {
                        screen: "CreateEvent",
                        params: { eventId: item.id, isUpdate: true },
                      },
                    });
                  }}
                >
                  Cập nhật sự kiện
                </Button>
              )}

              {canCheckIn && (
                <Button
                  mode="contained"
                  icon="qrcode-scan"
                  style={{ backgroundColor: COLORS.success, marginVertical: 4 }}
                  onPress={() => {
                    // Navigate directly to the CheckIn screen with the event ID
                    navigation.navigate("home", {
                      screen: "CheckIn",
                      params: { eventId: item.id },
                    });
                  }}
                >
                  {item.status === "ongoing"
                    ? "Check-in"
                    : isEarlyCheckIn
                      ? "Early Check-in"
                      : "Check-in"}
                </Button>
              )}

              {canDiscount && (
                <Button
                  mode="contained"
                  icon="ticket-percent"
                  style={{
                    backgroundColor: COLORS.warning ?? "#FFA500",
                    marginVertical: 4,
                  }}
                  onPress={() =>
                    navigation.navigate("home", {
                      screen: "CreateDiscount",
                      params: { eventId: item.id },
                    })
                  }
                >
                  Tạo Discount
                </Button>
              )}
            </View>
          </View>
        </Surface>
      );
    },
    [navigation, formatDate, getStatusChip, activeTab]
  );

  const renderEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="calendar-end"
          size={80}
          color={COLORS.primary}
        />
        <Text style={styles.emptyText}>
          {activeTab === "upcoming"
            ? "Bạn chưa có sự kiện nào sắp tới"
            : activeTab === "ongoing"
              ? "Bạn chưa có sự kiện nào đang diễn ra"
              : activeTab === "completed"
                ? "Bạn chưa có sự kiện nào đã kết thúc"
                : "Bạn chưa có sự kiện nào bị hủy"}
        </Text>
        <Button
          mode="contained"
          icon="calendar-plus"
          style={{ marginTop: 16, backgroundColor: COLORS.primary }}
          onPress={() =>
            navigation.navigate("Main", {
              screen: "home",
              params: {
                screen: "CreateEvent",
              },
            })
          }
          //         onPress={() => navigation.navigate('home', {
          //                       screen: 'CreateEvent',
          //                     })}
        >
          Tạo sự kiện mới
        </Button>
      </View>
    ),
    [activeTab, navigation]
  );

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMoreEvents) {
      console.log(`📜 Tải thêm sự kiện: trang ${currentPage + 1}`);
      fetchEvents(activeTab, currentPage + 1);
    }
  }, [loading, hasMoreEvents, currentPage, activeTab, fetchEvents]);

  const renderFooter = useCallback(() => {
    if (!hasMoreEvents) return null;

    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text
          style={{
            textAlign: "center",
            marginTop: 8,
            color: COLORS.textSecondary,
          }}
        >
          Đang tải thêm...
        </Text>
      </View>
    );
  }, [hasMoreEvents]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sự kiện của tôi</Text>
        <Text style={styles.subtitle}>Quản lý các sự kiện bạn tổ chức</Text>
      </View>

      <View style={styles.tabsContainer}>
        {["upcoming", "ongoing", "completed", "canceled"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              if (activeTab !== tab) {
                console.log(`🔄 Chuyển tab từ ${activeTab} sang ${tab}`);
                setActiveTab(tab);
              }
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab === "upcoming"
                ? "Sắp diễn ra"
                : tab === "ongoing"
                  ? "Đang diễn ra"
                  : tab === "completed"
                    ? "Đã kết thúc"
                    : "Đã hủy"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {initialLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 16, color: COLORS.textSecondary }}>
            Đang tải sự kiện...
          </Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={24}
            color={COLORS.error}
          />
          <Text style={styles.errorText}>{loadError}</Text>
          <Button
            mode="contained"
            onPress={onRefresh}
            style={styles.retryButton}
          >
            Thử lại
          </Button>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => `event-${item.id}`}
          renderItem={renderEventItem}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={{ flexGrow: 1 }}
          extraData={activeTab} // Ensure FlatList re-renders when activeTab changes
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}

      <FAB
        style={styles.fab}
        icon="calendar-plus"
        color="white"
        onPress={() =>
          navigation.navigate("Main", {
            screen: "home",
            params: {
              screen: "CreateEvent",
            },
          })
        }
        //         onPress={() => navigation.navigate('home', {
        //                       screen: 'CreateEvent',
        //                     })}
      />
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
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
  eventCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  eventCardContent: {
    borderRadius: 12,
    overflow: "hidden",
  },
  eventHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },
  eventDate: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  eventDetails: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  eventLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  eventValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "bold",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  statusChip: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  eventImage: {
    width: "100%",
    height: 150,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
  },
  tabsContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
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
    fontWeight: "bold",
  },
  actionButtons: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
  },
  errorContainer: {
    padding: 20,
    alignItems: "center",
  },
  errorText: {
    color: COLORS.error,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
  },
});

export default MyEvents;
