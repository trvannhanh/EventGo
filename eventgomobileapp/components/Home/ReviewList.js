import React, { useEffect, useState, useContext, useCallback } from "react";
import {
  FlatList,
  View,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  Card,
  Title,
  Paragraph,
  Avatar,
  Divider,
  Surface,
  IconButton,
} from "react-native-paper";
import { AntDesign, MaterialCommunityIcons } from "@expo/vector-icons";
import api, { endpoints, authApis } from "../../configs/Apis";
import { MyUserContext } from "../../configs/MyContexts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../../components/styles/MyStyles";

const ReviewList = ({ route, navigation }) => {
  const { eventId, eventName } = route.params;
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const user = useContext(MyUserContext);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
      padding: 16,
    },
    header: {
      padding: 16,
      backgroundColor: COLORS.background,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: COLORS.primary,
      textAlign: "center",
      marginBottom: 16,
    },
    ratingContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 8,
    },
    ratingCircle: {
      backgroundColor: COLORS.primary,
      width: 70,
      height: 70,
      borderRadius: 35,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 16,
    },
    ratingNumber: {
      fontSize: 24,
      fontWeight: "bold",
      color: "white",
    },
    starsContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    reviewCount: {
      color: COLORS.textSecondary,
      marginTop: 4,
    },
    reviewCard: {
      marginBottom: 12,
      elevation: 2,
      backgroundColor: COLORS.background,
      borderRadius: 8,
    },
    reviewHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    reviewUserInfo: {
      marginLeft: 12,
      flex: 1,
    },
    reviewUserName: {
      fontWeight: "bold",
      color: COLORS.text,
    },
    reviewDate: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    reviewStars: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 8,
    },
    reviewComment: {
      color: COLORS.text,
      lineHeight: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorIcon: {
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: COLORS.error,
      marginBottom: 8,
      textAlign: "center",
    },
    errorMessage: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: "center",
      marginBottom: 24,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: COLORS.textSecondary,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyMessage: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: "center",
    },
    replyContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: COLORS.primaryLight || "#e6e6ff",
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
      fontSize: 14,
      color: COLORS.primary,
      marginLeft: 6,
      flex: 1,
    },
    replyDate: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    replyText: {
      color: COLORS.text,
      marginTop: 4,
      fontSize: 14,
      lineHeight: 20,
    },
    replyButton: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      padding: 8,
      borderRadius: 6,
      backgroundColor: COLORS.primaryLight || "#e6e6ff",
      alignSelf: "flex-start",
    },
    replyButtonText: {
      color: COLORS.primary,
      marginLeft: 6,
      fontWeight: "500",
      fontSize: 14,
    },
  });
  const fetchReviews = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
        console.log("Refreshing reviews list...");
      } else if (!refreshing) {
        setLoading(true);
      }

      // Get token from AsyncStorage
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        console.log("No token found, handling unauthenticated state");
        setError("Bạn cần đăng nhập để xem đánh giá");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Create authApi with token
      const authApi = authApis(token);

      const response = await authApi.get(endpoints.eventReviews(eventId));
      console.log(
        "Reviews fetched successfully, count:",
        response.data.reviews?.length || 0
      );

      // Parse response to be compatible with both formats
      if (response.data && response.data.reviews) {
        // New format from backend: { reviews: [...], average_rating: X, total_reviews: Y }
        setReviews(response.data.reviews || []);
        setAverageRating(response.data.average_rating || 0);
        setTotalReviews(response.data.total_reviews || 0);
      } else if (Array.isArray(response.data)) {
        // Old format: [...]
        setReviews(response.data);
        // Calculate statistics from array
        setTotalReviews(response.data.length);
        if (response.data.length > 0) {
          const sum = response.data.reduce(
            (acc, review) => acc + (review.rating || 0),
            0
          );
          setAverageRating(sum / response.data.length);
        }
      } else {
        // No valid data
        setReviews([]);
        setAverageRating(0);
        setTotalReviews(0);
      }

      setError(null);
    } catch (err) {
      console.error(
        "Error details:",
        JSON.stringify(err.response?.data || err.message)
      );

      if (err.response && err.response.status === 401) {
        // Better UX with clear login again message
        Alert.alert(
          "Phiên đăng nhập hết hạn",
          "Bạn cần đăng nhập lại để tiếp tục.",
          [
            {
              text: "Hủy",
              style: "cancel",
            },
            {
              text: "Đăng nhập",
              onPress: async () => {
                // Clear current token as it's expired
                await AsyncStorage.removeItem("token");
                await AsyncStorage.removeItem("refresh_token");
                navigation.navigate("login");
              },
            },
          ]
        );
      }

      setReviews([]);
      setAverageRating(0);
      setTotalReviews(0);
      setError(`Không thể tải đánh giá: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchReviews();
  }, [eventId, user]); // Handle refresh when returning from ReplyToReview
  useEffect(() => {
    // Trigger refresh when timestamp changes (indicating return from reply)
    if (route.params?.timestamp) {
      console.log(
        "ReviewList: Refreshing after reply submission with timestamp:",
        route.params.timestamp
      );
      fetchReviews(true);
      // Clear the timestamp to avoid infinite refresh
      navigation.setParams({ timestamp: undefined });
    }
  }, [route.params?.timestamp]);

  // Add an effect to handle refresh when returning from ReplyToReview (legacy support)
  useEffect(() => {
    if (route.params?.refreshOnReturn) {
      console.log("ReviewList: Refreshing after reply submission (legacy)");
      fetchReviews(true);
      // Clear the param to avoid re-updating on other navigation events
      navigation.setParams({ refreshOnReturn: undefined });
    }
  }, [route.params?.refreshOnReturn]);

  // Add an effect to handle reviews refreshed via navigation params (backward compatibility)
  useEffect(() => {
    if (route.params?.refreshReviews && route.params?.updatedReviews) {
      console.log(
        "ReviewList: Updating reviews with data from navigation params"
      );
      setReviews(route.params.updatedReviews);

      // Recalculate average rating and total reviews
      if (route.params.updatedReviews.length > 0) {
        const sum = route.params.updatedReviews.reduce(
          (acc, review) => acc + (review.rating || 0),
          0
        );
        setAverageRating(sum / route.params.updatedReviews.length);
      }
      setTotalReviews(route.params.updatedReviews.length);

      // Clear the params to avoid re-updating on other navigation events
      navigation.setParams({
        refreshReviews: undefined,
        updatedReviews: undefined,
      });
    }
  }, [route.params?.refreshReviews, route.params?.updatedReviews]);

  // Pull-to-refresh functionality
  const onRefresh = useCallback(() => {
    fetchReviews(true);
  }, [eventId]);
  // Header component with rating summary
  const ReviewHeader = () => (
    <Surface style={styles.header} elevation={2}>
      <Text style={styles.headerTitle}>Đánh giá sự kiện: {eventName}</Text>
      <View style={styles.ratingContainer}>
        <View style={styles.ratingCircle}>
          <Text style={styles.ratingNumber}>{averageRating.toFixed(1)}</Text>
        </View>

        <View>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <AntDesign
                key={star}
                name={star <= averageRating ? "star" : "staro"}
                size={20}
                color={star <= averageRating ? "#FFD700" : COLORS.border}
                style={{ marginRight: 2 }}
              />
            ))}
          </View>
          <Text style={styles.reviewCount}>
            {totalReviews} {totalReviews === 1 ? "đánh giá" : "đánh giá"}
          </Text>
        </View>
      </View>{" "}
    </Surface>
  );

  // Render item for each review
  const renderReviewItem = ({ item }) => {
    if (!item) return null;

    return (
      <Surface style={styles.reviewCard} elevation={2}>
        <View style={{ padding: 16 }}>
          <View style={styles.reviewHeader}>
            {item.user_avatar ? (
              <Avatar.Image size={40} source={{ uri: item.user_avatar }} />
            ) : (
              <Avatar.Icon
                size={40}
                icon="account"
                style={{ backgroundColor: COLORS.primary }}
              />
            )}
            <View style={styles.reviewUserInfo}>
              <Text style={styles.reviewUserName}>
                {item.user || "Người dùng ẩn danh"}
              </Text>
              <Text style={styles.reviewDate}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString()
                  : "Không rõ thời gian"}
              </Text>
            </View>
          </View>

          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <AntDesign
                key={star}
                name={star <= (item.rating || 0) ? "star" : "staro"}
                size={16}
                color={star <= (item.rating || 0) ? "#FFD700" : COLORS.border}
                style={{ marginRight: 2 }}
              />
            ))}
          </View>

          <Text style={styles.reviewComment}>
            {item.comment || "Không có nội dung"}
          </Text>

          {/* Hiển thị phản hồi từ BTC nếu có */}
          {item.reply && (
            <View style={styles.replyContainer}>
              <View style={styles.replyHeader}>
                <MaterialCommunityIcons
                  name="reply"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.replyAuthor}>
                  {item.replied_by_username || "Ban tổ chức"} đã phản hồi:
                </Text>
                {item.replied_at && (
                  <Text style={styles.replyDate}>
                    {new Date(item.replied_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <Text style={styles.replyText}>{item.reply}</Text>
            </View>
          )}
          {/* Nút phản hồi dành cho BTC hoặc Admin */}
          {user &&
            (user.is_superuser ||
              (item.event_id && user.role === "organizer")) &&
            !item.reply && (
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() =>
                  navigation.navigate("ReplyToReview", {
                    eventId: eventId,
                    reviewId: item.id,
                    eventName: eventName,
                    fromScreen: "ReviewList",
                  })
                }
              >
                <MaterialCommunityIcons
                  name="reply"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.replyButtonText}>Phản hồi đánh giá</Text>
              </TouchableOpacity>
            )}
        </View>
      </Surface>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 16, color: COLORS.textSecondary }}>
          Đang tải đánh giá...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={60}
          color={COLORS.error}
          style={styles.errorIcon}
        />
        <Text style={styles.errorTitle}>Đã xảy ra lỗi</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }
  // Đảm bảo reviews là một mảng trước khi truyền vào FlatList
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  return (
    <View style={styles.container}>
      <FlatList
        data={safeReviews}
        renderItem={renderReviewItem}
        keyExtractor={(item, index) =>
          item && item.id ? item.id.toString() : index.toString()
        }
        ListHeaderComponent={<ReviewHeader />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="comment-text-outline"
              size={60}
              color={COLORS.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>Chưa có đánh giá nào</Text>
            <Text style={styles.emptyMessage}>
              Hãy là người đầu tiên đánh giá sự kiện này
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={{
          flexGrow: safeReviews.length === 0 ? 1 : undefined,
        }}
      />
    </View>
  );
};

export default ReviewList;
