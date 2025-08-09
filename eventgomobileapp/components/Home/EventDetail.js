import React, { useEffect, useState, useContext, useCallback } from "react";
import {
  ScrollView,
  ActivityIndicator,
  Image,
  Text,
  View,
  Alert,
  TouchableOpacity,
  Linking,
  StyleSheet,
  RefreshControl,
  Share,
} from "react-native";
import {
  Button,
  Avatar,
  Divider,
  Portal,
  Modal,
  TextInput,
  List,
  Surface,
  Chip,
  IconButton,
  FAB,
} from "react-native-paper";
import {
  MaterialCommunityIcons,
  AntDesign,
  Ionicons,
  FontAwesome5,
  MaterialIcons,
} from "@expo/vector-icons";
import api, { endpoints, authApis } from "../../configs/Apis";
import MyStyles, { COLORS } from "../styles/MyStyles";
import { MyUserContext } from "../../configs/MyContexts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker } from "react-native-maps";

const EventDetail = ({ route, navigation }) => {
  const { eventId } = route.params;
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [selectedTicketType, setSelectedTicketType] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const user = useContext(MyUserContext);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    imageContainer: {
      position: "relative",
      height: 250,
    },
    eventImage: {
      width: "100%",
      height: "100%",
    },
    imageOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "flex-end",
    },
    backButton: {
      position: "absolute",
      top: 16,
      left: 16,
      zIndex: 10,
      backgroundColor: "rgba(255,255,255,0.8)",
      borderRadius: 20,
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    shareButton: {
      position: "absolute",
      top: 16,
      right: 16,
      zIndex: 10,
      backgroundColor: "rgba(255,255,255,0.8)",
      borderRadius: 20,
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    contentContainer: {
      padding: 16,
      marginTop: -20,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: COLORS.background,
    },
    eventTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: COLORS.text,
      marginBottom: 8,
    },
    eventByline: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginBottom: 16,
    },
    chipContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginVertical: 8,
    },
    chip: {
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: COLORS.primaryLight,
    },
    chipText: {
      color: COLORS.primary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: COLORS.primary,
      marginVertical: 12,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    infoIcon: {
      marginRight: 12,
      width: 24,
      alignItems: "center",
    },
    infoText: {
      flex: 1,
      fontSize: 15,
      color: COLORS.text,
    },
    descriptionContainer: {
      marginVertical: 16,
    },
    description: {
      fontSize: 15,
      color: COLORS.text,
      lineHeight: 22,
    },
    ticketSection: {
      marginVertical: 16,
    },
    ticketRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      padding: 12,
      backgroundColor: COLORS.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    ticketType: {
      fontSize: 16,
      fontWeight: "bold",
      color: COLORS.text,
    },
    ticketPrice: {
      fontSize: 15,
      color: COLORS.primary,
      fontWeight: "bold",
    },
    ticketDescription: {
      fontSize: 13,
      color: COLORS.textSecondary,
      marginTop: 4,
    },
    ticketsRemaining: {
      fontSize: 13,
      color: COLORS.textSecondary,
    },
    organizerSection: {
      marginVertical: 16,
    },
    organizerRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    organizerInfo: {
      marginLeft: 12,
      flex: 1,
    },
    organizerName: {
      fontSize: 16,
      fontWeight: "bold",
      color: COLORS.text,
    },
    reviewsSection: {
      marginVertical: 16,
    },
    reviewCard: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 8,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    reviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    reviewUser: {
      fontSize: 15,
      fontWeight: "bold",
      marginLeft: 8,
    },
    starContainer: {
      flexDirection: "row",
      marginVertical: 8,
    },
    reviewContent: {
      fontSize: 14,
      color: COLORS.text,
      marginTop: 4,
    },
    replyContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: COLORS.primaryLight || "#f0f0ff",
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: COLORS.primary,
    },
    replyHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    replyAuthor: {
      fontWeight: "bold",
      fontSize: 13,
      color: COLORS.primary,
      marginLeft: 6,
      flex: 1,
    },
    replyDate: {
      fontSize: 11,
      color: COLORS.textSecondary,
    },
    replyText: {
      color: COLORS.text,
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
    },
    replyButton: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      padding: 6,
      borderRadius: 6,
      backgroundColor: COLORS.primaryLight || "#f0f0ff",
      alignSelf: "flex-start",
    },
    replyButtonText: {
      color: COLORS.primary,
      marginLeft: 4,
      fontWeight: "500",
      fontSize: 12,
    },
    modalContainer: {
      backgroundColor: "white",
      padding: 20,
      margin: 20,
      borderRadius: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 16,
      color: COLORS.primary,
      textAlign: "center",
    },
    starRatingContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginVertical: 16,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 16,
    },
    fab: {
      position: "absolute",
      margin: 16,
      right: 0,
      bottom: 0,
      backgroundColor: COLORS.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    noReviewsText: {
      textAlign: "center",
      color: COLORS.textSecondary,
      marginVertical: 16,
    },
    reviewDate: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginLeft: "auto",
    },
    ratingText: {
      fontSize: 16,
      fontWeight: "bold",
      color: COLORS.text,
      textAlign: "center",
      marginVertical: 8,
    },
    modalInput: {
      marginVertical: 12,
      backgroundColor: COLORS.background,
    },
  });
  useEffect(() => {
    fetchEventData();
  }, [eventId, user]); 
  useEffect(() => {
  
    if (route.params?.timestamp) {
      console.log(
        "Refreshing reviews after reply submission with timestamp:",
        route.params.timestamp
      );
      fetchEventData(true);
      navigation.setParams({ timestamp: undefined });
    }
  }, [route.params?.timestamp]);

  useEffect(() => {
    if (route.params?.refreshOnReturn) {
      console.log("Refreshing reviews after reply submission (legacy)");
      fetchEventData(true);
      navigation.setParams({ refreshOnReturn: undefined });
    }
  }, [route.params?.refreshOnReturn]);

  useEffect(() => {
    if (route.params?.refreshReviews && route.params?.updatedReviews) {
      console.log("Updating reviews with data from navigation params");
      setReviews(route.params.updatedReviews);
      navigation.setParams({
        refreshReviews: undefined,
        updatedReviews: undefined,
      });
    }
  }, [route.params?.refreshReviews, route.params?.updatedReviews]);

  const submitReview = async () => {
    if (!user) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để đánh giá");
      return;
    }

    if (rating < 1 || rating > 5 || !comment) {
      Alert.alert("Lỗi", "Vui lòng chọn số sao (1-5) và nhập nhận xét");
      return;
    }

    setReviewSubmitting(true);

    try {
      const reviewData = {
        rating: parseInt(rating, 10),
        comment: comment.trim(),
        event_id: eventId,
      };
      console.log("Gửi đánh giá với dữ liệu:", reviewData);
      console.log("URL endpoint:", endpoints.submitReview(eventId));
      console.log(
        "Authentication status:",
        user ? "Logged in" : "Not logged in"
      );

      const authApi = authApis(user.access_token);
      const response = await authApi.post(
        endpoints.submitReview(eventId),
        reviewData
      );

      console.log("Phản hồi từ server:", response.data);
      Alert.alert("Thành công", "Đánh giá của bạn đã được gửi");
      setModalVisible(false);
      setRating(5);
      setComment("");

      await fetchEventData(true);
      setHasReviewed(true);
    } catch (err) {
      console.error("Lỗi khi gửi đánh giá:", err);
      console.error(
        "Chi tiết lỗi:",
        JSON.stringify(err.response?.data || err.message, null, 2)
      );
      console.error("Status code:", err.response?.status);
      console.error(
        "Response headers:",
        JSON.stringify(err.response?.headers, null, 2)
      );

      if (err.response && err.response.status === 401) {
        Alert.alert(
          "Cần đăng nhập",
          "Bạn cần đăng nhập để đánh giá sự kiện này.",
          [{ text: "Đăng nhập", onPress: () => navigation.navigate("login") }]
        );
      }
      else if (err.response && err.response.status === 403) {
        Alert.alert(
          "Không thể đánh giá",
          err.response?.data?.error ||
            "Bạn không thể đánh giá sự kiện mà bạn không tham gia."
        );
      }
      else if (err.response && err.response.status === 400) {
        Alert.alert(
          "Dữ liệu không hợp lệ",
          err.response?.data?.error ||
            "Vui lòng kiểm tra lại thông tin đánh giá của bạn."
        );
      }
      else if (err.response && err.response.status === 500) {
        Alert.alert(
          "Lỗi máy chủ",
          "Đã xảy ra lỗi ở máy chủ. Vui lòng thử lại sau hoặc liên hệ quản trị viên."
        );
      }
      // Xử lý lỗi không được phép đánh giá (chưa tham gia sự kiện)
      else if (err.response?.data?.non_field_errors) {
        // Hiển thị thông báo lỗi cụ thể từ server
        Alert.alert(
          "Không thể đánh giá",
          err.response.data.non_field_errors[0] ||
            "Bạn cần tham gia sự kiện trước khi đánh giá."
        );
      }
      // Kiểm tra chi tiết lỗi từ API khác nhau
      else if (err.response?.data?.error) {
        Alert.alert("Lỗi", err.response.data.error);
      } // Xử lý các lỗi khác
      else {
        Alert.alert(
          "Lỗi",
          err.response?.data?.detail ||
            err.response?.data?.message ||
            err.response?.data?.error ||
            "Không thể gửi đánh giá. Vui lòng thử lại sau."
        );
      }
    } finally {
      setReviewSubmitting(false);
    }
  };
  const fetchEventData = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
      console.log("Refreshing event data...");
    }

    try {
      // Fetch event details
      const eventRes = await api.get(endpoints.eventDetail(eventId));
      setEvent(eventRes.data);
      console.log("Event data fetched successfully"); // Fetch reviews - sử dụng authApis nếu user đã đăng nhập để có quyền truy cập
      let reviewsRes;
      if (user) {
        const token = await AsyncStorage.getItem("token");
        if (token) {
          const authApi = authApis(token);
          reviewsRes = await authApi.get(endpoints.eventReviews(eventId));
        } else {
          reviewsRes = await api.get(endpoints.eventReviews(eventId));
        }
      } else {
        reviewsRes = await api.get(endpoints.eventReviews(eventId));
      }

      console.log("Reviews API response:", reviewsRes.data);

      // Xử lý response theo format mới từ backend
      if (reviewsRes.data && reviewsRes.data.reviews) {
        setReviews(reviewsRes.data.reviews);
        console.log(
          "Reviews fetched successfully, count:",
          reviewsRes.data.reviews.length
        );
      } else if (Array.isArray(reviewsRes.data)) {
        setReviews(reviewsRes.data);
        console.log(
          "Reviews fetched successfully, count:",
          reviewsRes.data.length
        );
      } else {
        setReviews([]);
        console.log("No reviews found");
      }

      // Check if user has reviewed
      if (user) {
        const allReviews = reviewsRes.data.reviews || reviewsRes.data || [];
        const userReviewed = allReviews.some(
          (review) => review.user === user.username
        );
        setHasReviewed(userReviewed);

        // If user hasn't reviewed, default to allowing reviews
        if (!userReviewed) {
          setCanReview(true);
        }
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
      Alert.alert("Lỗi", "Không thể tải dữ liệu mới. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setReviewsLoading(false);
    }
  };
  const onRefresh = useCallback(() => {
    console.log("Manual refresh triggered");
    fetchEventData(true);
  }, [eventId, user]);

  const shareEvent = async () => {
    if (!event) return;

    try {
      await Share.share({
        message: `Tham gia sự kiện "${event.name}" tại ${event.venue || "EventGo"}! Ngày: ${event.event_date}, Giờ: ${event.event_time || "Đang cập nhật"}. Xem chi tiết và đặt vé trên ứng dụng EventGo.`,
        title: `Sự kiện: ${event.name}`,
      });
    } catch (error) {
      console.error("Error sharing event:", error);
    }
  };

  const openMap = () => {
    if (event?.google_maps_link) {
      Linking.openURL(event.google_maps_link);
    } else {
      Alert.alert(
        "Thông báo",
        "Sự kiện này chưa cập nhật địa điểm trên bản đồ."
      );
    }
  };

  const bookTicket = (ticketType) => {
    setSelectedTicketType(ticketType);
    setQuantity(1);
    setBookingModalVisible(true);
  };

  const confirmBooking = async () => {
    if (!user) {
      Alert.alert("Thông báo", "Vui lòng đăng nhập để đặt vé");
      navigation.navigate("login");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại");
        navigation.navigate("login");
        return;
      }

      navigation.navigate("BookTicket", {
        eventId: event.id,
        ticketTypeId: selectedTicketType.id,
        quantity: quantity,
      });
      setBookingModalVisible(false);
    } catch (error) {
      console.error("Error navigating to booking:", error);
      Alert.alert("Lỗi", "Không thể đặt vé. Vui lòng thử lại sau.");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Đang cập nhật";

    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", options);
  };

  const formatTime = (timeString) => {
    return timeString ? timeString.substring(0, 5) : "Đang cập nhật";
  };

  const renderStars = (rating) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <AntDesign
            key={star}
            name={star <= rating ? "star" : "staro"}
            size={16}
            color={star <= rating ? "#FFD700" : COLORS.border}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 16, color: COLORS.textSecondary }}>
          Đang tải thông tin sự kiện...
        </Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons
          name="calendar-remove"
          size={60}
          color={COLORS.error}
        />
        <Text
          style={{ marginTop: 16, color: COLORS.error, textAlign: "center" }}
        >
          Không tìm thấy thông tin sự kiện. Sự kiện có thể đã bị xóa hoặc không
          tồn tại.
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 20, backgroundColor: COLORS.primary }}
        >
          Quay lại
        </Button>
      </View>
    );
  }

  const getEventImage = () => {
    if (!event.image) return null;

    if (event.image.startsWith("http")) {
      return { uri: event.image };
    } else {
      return { uri: `https://res.cloudinary.com/dqpkxxzaf/${event.image}` };
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.imageContainer}>
          {getEventImage() ? (
            <Image
              source={getEventImage()}
              style={styles.eventImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.eventImage,
                {
                  backgroundColor: COLORS.primaryLight,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="calendar-blank"
                size={80}
                color={COLORS.primary}
              />
            </View>
          )}
          <View style={styles.imageOverlay} />
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButton} onPress={shareEvent}>
          <MaterialCommunityIcons
            name="share-variant"
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>

        <Surface style={styles.contentContainer} elevation={0}>
          <Text style={styles.eventTitle}>{event.name}</Text>
          <Text style={styles.eventByline}>
            Được tổ chức bởi {event.organizer?.username || "EventGo"}
          </Text>

          {event.categories && event.categories.length > 0 && (
            <View style={styles.chipContainer}>
              {event.categories.map((category, index) => (
                <Chip
                  key={index}
                  style={styles.chip}
                  textStyle={styles.chipText}
                >
                  {category.name}
                </Chip>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Thông tin sự kiện</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <MaterialCommunityIcons
                name="calendar"
                size={24}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.infoText}>{formatDate(event.event_date)}</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={24}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.infoText}>{formatTime(event.event_time)}</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <MaterialCommunityIcons
                name="map-marker"
                size={24}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.infoText}>
              {event.venue || "Đang cập nhật địa điểm"}
            </Text>
          </View>

          {/* Bản đồ mini chỉ xem vị trí */}
          {event.google_maps_link && (
            <View
              style={{
                height: 180,
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <MapView
                style={{ flex: 1 }}
                pointerEvents="none" // Không cho tương tác
                initialRegion={(() => {
                  // Cố gắng lấy lat/lng từ link Google Maps
                  const match =
                    event.google_maps_link.match(/q=([\d.]+),([\d.]+)/);
                  if (match) {
                    return {
                      latitude: parseFloat(match[1]),
                      longitude: parseFloat(match[2]),
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    };
                  }
                  return {
                    latitude: 10.762622,
                    longitude: 106.660172,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  };
                })()}
              >
                {(() => {
                  const match =
                    event.google_maps_link.match(/q=([\d.]+),([\d.]+)/);
                  if (match) {
                    return (
                      <Marker
                        coordinate={{
                          latitude: parseFloat(match[1]),
                          longitude: parseFloat(match[2]),
                        }}
                      />
                    );
                  }
                  return null;
                })()}
              </MapView>
            </View>
          )}

          {event.google_maps_link && (
            <Button
              mode="outlined"
              icon="map-marker"
              onPress={openMap}
              style={{ marginTop: 8, borderColor: COLORS.primary }}
              labelStyle={{ color: COLORS.primary }}
            >
              Xem trên Google Maps
            </Button>
          )}

          <View style={styles.descriptionContainer}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>

          {event.tickets && event.tickets.length > 0 && (
            <View style={styles.ticketSection}>
              <Text style={styles.sectionTitle}>Đặt vé</Text>

              {event.tickets.map((ticket, index) => (
                <Surface
                  key={index}
                  style={[styles.ticketRow, { elevation: 1 }]}
                >
                  <View>
                    <Text style={styles.ticketType}>{ticket.name}</Text>
                    <Text style={styles.ticketDescription}>
                      {ticket.description || "Vé tham dự sự kiện"}
                    </Text>
                    <Text style={styles.ticketsRemaining}>
                      {ticket.quantity > 0
                        ? `Còn ${ticket.quantity} vé`
                        : "Hết vé"}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.ticketPrice}>
                      {ticket.price.toLocaleString("vi-VN")} VNĐ
                    </Text>
                    <Button
                      mode="contained"
                      disabled={ticket.quantity <= 0}
                      onPress={() => bookTicket(ticket)}
                      style={{ marginTop: 4, backgroundColor: COLORS.primary }}
                      labelStyle={{ fontSize: 12 }}
                      compact
                    >
                      Đặt vé
                    </Button>
                  </View>
                </Surface>
              ))}
            </View>
          )}

          {event.organizer && (
            <View style={styles.organizerSection}>
              <Text style={styles.sectionTitle}>Thông tin nhà tổ chức</Text>
              <Surface
                style={[
                  styles.organizerRow,
                  { padding: 12, borderRadius: 8, elevation: 1 },
                ]}
              >
                <Avatar.Icon
                  icon="account"
                  size={50}
                  style={{ backgroundColor: COLORS.primary }}
                />
                <View style={styles.organizerInfo}>
                  <Text style={styles.organizerName}>
                    {event.organizer.username}
                  </Text>
                  <Text style={{ color: COLORS.textSecondary }}>
                    Đã tổ chức {event.organizer.event_count || 0} sự kiện
                  </Text>
                </View>
              </Surface>
            </View>
          )}

          <View style={styles.reviewsSection}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={styles.sectionTitle}>Đánh giá và nhận xét</Text>
              {reviews.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <AntDesign name="star" size={18} color="#FFD700" />
                  <Text style={{ marginLeft: 4, fontWeight: "bold" }}>
                    {(
                      reviews.reduce((sum, r) => sum + r.rating, 0) /
                      reviews.length
                    ).toFixed(1)}
                  </Text>
                  <Text style={{ marginLeft: 2, color: COLORS.textSecondary }}>
                    ({reviews.length})
                  </Text>
                </View>
              )}
            </View>

            {reviewsLoading ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ marginVertical: 16 }}
              />
            ) : reviews.length > 0 ? (
              <>
                {" "}
                {reviews.slice(0, 3).map((review, index) => (
                  <Surface
                    key={index}
                    style={[styles.reviewCard, { elevation: 1 }]}
                  >
                    <View style={styles.reviewHeader}>
                      <Avatar.Icon
                        size={36}
                        icon="account"
                        style={{ backgroundColor: COLORS.primaryLight }}
                      />
                      <Text style={styles.reviewUser}>{review.user}</Text>
                      <Text style={styles.reviewDate}>
                        {new Date(review.created_date).toLocaleDateString()}
                      </Text>
                    </View>
                    {renderStars(review.rating)}
                    <Text style={styles.reviewContent}>{review.comment}</Text>

                    {review.reply && (
                      <View style={styles.replyContainer}>
                        <View style={styles.replyHeader}>
                          <MaterialCommunityIcons
                            name="reply"
                            size={16}
                            color={COLORS.primary}
                          />
                          <Text style={styles.replyAuthor}>
                            {review.replied_by_username || "Ban tổ chức"} đã
                            phản hồi:
                          </Text>
                          {review.replied_at && (
                            <Text style={styles.replyDate}>
                              {new Date(review.replied_at).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.replyText}>{review.reply}</Text>
                      </View>
                    )}

                    {user &&
                      (user.id === event.organizer?.id || user.is_superuser) &&
                      !review.reply && (
                        <TouchableOpacity
                          style={styles.replyButton}
                          onPress={() =>
                            navigation.navigate("ReplyToReview", {
                              eventId: event.id,
                              reviewId: review.id,
                              eventName: event.name,
                              fromScreen: "EventDetail",
                            })
                          }
                        >
                          <MaterialCommunityIcons
                            name="reply"
                            size={14}
                            color={COLORS.primary}
                          />
                          <Text style={styles.replyButtonText}>Phản hồi</Text>
                        </TouchableOpacity>
                      )}
                  </Surface>
                ))}
                {reviews.length > 3 && (
                  <Button
                    mode="outlined"
                    onPress={() =>
                      navigation.navigate("ReviewList", {
                        eventId: event.id,
                        eventName: event.name,
                      })
                    }
                    style={{ marginTop: 8, borderColor: COLORS.primary }}
                    labelStyle={{ color: COLORS.primary }}
                  >
                    Xem tất cả {reviews.length} đánh giá
                  </Button>
                )}
              </>
            ) : (
              <Text style={styles.noReviewsText}>
                Chưa có đánh giá nào cho sự kiện này
              </Text>
            )}

            {user && canReview && !hasReviewed && (
              <Button
                mode="contained"
                icon="star"
                onPress={() => setModalVisible(true)}
                style={{ marginTop: 16, backgroundColor: COLORS.primary }}
              >
                Viết đánh giá
              </Button>
            )}

            {hasReviewed && (
              <Text
                style={{
                  fontStyle: "italic",
                  textAlign: "center",
                  marginTop: 8,
                  color: COLORS.textSecondary,
                }}
              >
                Bạn đã đánh giá sự kiện này
              </Text>
            )}
          </View>
        </Surface>
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="ticket-percent"
        label="Đặt vé"
        onPress={() => navigation.navigate("BookTicket", { eventId: event.id })}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Đánh giá sự kiện</Text>

          <Text style={styles.ratingText}>Chọn số sao ({rating}/5)</Text>
          <View style={styles.starRatingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <AntDesign
                  name={star <= rating ? "star" : "staro"}
                  size={36}
                  color={star <= rating ? "#FFD700" : COLORS.border}
                  style={{ marginHorizontal: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            mode="outlined"
            label="Nhận xét của bạn"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={styles.modalInput}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={{ borderColor: COLORS.border }}
            >
              Hủy
            </Button>

            <Button
              mode="contained"
              onPress={submitReview}
              loading={reviewSubmitting}
              disabled={reviewSubmitting || !comment}
              style={{ backgroundColor: COLORS.primary }}
            >
              Gửi đánh giá
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Booking Modal */}
      <Portal>
        <Modal
          visible={bookingModalVisible}
          onDismiss={() => setBookingModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedTicketType && (
            <>
              <Text style={styles.modalTitle}>
                Đặt vé {selectedTicketType.name}
              </Text>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  textAlign: "center",
                  color: COLORS.primary,
                }}
              >
                {selectedTicketType.price.toLocaleString("vi-VN")} VNĐ / vé
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  color: COLORS.textSecondary,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                {selectedTicketType.description || "Vé tham dự sự kiện"}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  marginVertical: 16,
                }}
              >
                <IconButton
                  icon="minus"
                  size={24}
                  onPress={() => quantity > 1 && setQuantity(quantity - 1)}
                  disabled={quantity <= 1}
                  style={{ backgroundColor: COLORS.border }}
                />
                <Text
                  style={{
                    marginHorizontal: 16,
                    fontSize: 20,
                    fontWeight: "bold",
                  }}
                >
                  {quantity}
                </Text>
                <IconButton
                  icon="plus"
                  size={24}
                  onPress={() =>
                    quantity < selectedTicketType.quantity &&
                    setQuantity(quantity + 1)
                  }
                  disabled={quantity >= selectedTicketType.quantity}
                  style={{ backgroundColor: COLORS.primary }}
                  color="white"
                />
              </View>

              <View style={{ marginVertical: 16 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  Tổng tiền:{" "}
                  {(selectedTicketType.price * quantity).toLocaleString(
                    "vi-VN"
                  )}{" "}
                  VNĐ
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setBookingModalVisible(false)}
                  style={{ borderColor: COLORS.border }}
                >
                  Hủy
                </Button>

                <Button
                  mode="contained"
                  onPress={confirmBooking}
                  style={{ backgroundColor: COLORS.primary }}
                >
                  Tiếp tục
                </Button>
              </View>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
};
export default EventDetail;
