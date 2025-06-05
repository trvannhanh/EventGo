import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Image,
} from "react-native";
import {
  Card,
  Title,
  Paragraph,
  Button as PaperButton,
  Chip,
  Surface,
  IconButton,
} from "react-native-paper";
import api, { endpoints } from "../../configs/Apis";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MyStyles, { COLORS } from "../styles/MyStyles";

const Event = ({ navigation, search = "", eventType = "" }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
      padding: 12,
    },
    card: {
      marginBottom: 16,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: COLORS.background,
    },
    cardContent: {
      padding: 16,
    },
    eventImage: {
      width: "100%",
      height: 140,
      backgroundColor: COLORS.primaryLight,
    },
    eventHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    eventTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: COLORS.text,
      flex: 1,
      marginLeft: 8,
    },
    eventMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    eventMetaText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginLeft: 6,
    },
    eventDescription: {
      fontSize: 14,
      color: COLORS.text,
      marginBottom: 16,
      lineHeight: 20,
    },
    chipContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 12,
    },
    chip: {
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: COLORS.primaryLight,
    },
    chipText: {
      color: COLORS.primary,
    },
    actionButton: {
      backgroundColor: COLORS.primary,
    },
    buttonLabel: {
      color: "white",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorText: {
      color: COLORS.error,
      textAlign: "center",
      marginTop: 16,
      fontSize: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyText: {
      color: COLORS.textSecondary,
      textAlign: "center",
      fontSize: 16,
    },
    showMoreButton: {
      alignSelf: "center",
      marginTop: 8,
    },
  });

  const fetchEvents = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else if (!refreshing) {
        setLoading(true);
      }

      const res = await api.get(endpoints.events);
      if (res.data) {
        setEvents(res.data);
        setError(null);
      } else {
        throw new Error("No data received from server");
      }
    } catch (err) {
      console.error("Error loading events:", err);
      setError("Không thể tải danh sách sự kiện. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const onRefresh = useCallback(() => {
    fetchEvents(true);
  }, []);

  const filteredEvents = events.filter((event) => {
    const nameToCheck = event.title || event.name || "";
    const matchSearch = nameToCheck
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchType = eventType
      ? event.type === eventType || event.category?.name === eventType
      : true;
    return matchSearch && matchType;
  });

  const getEventImage = (event) => {
    if (!event.image) return null;

    if (event.image.startsWith("http")) {
      return { uri: event.image };
    } else {
      return { uri: `https://res.cloudinary.com/dqpkxxzaf/${event.image}` };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Đang cập nhật";

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  };

  const renderItem = ({ item }) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
    >
      {getEventImage(item) ? (
        <Image
          source={getEventImage(item)}
          style={styles.eventImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.eventImagePlaceholder}>
          <MaterialCommunityIcons
            name="calendar-blank"
            size={50}
            color={COLORS.primary}
          />
        </View>
      )}

      <View style={styles.cardContent}>
        <Text style={styles.eventTitle}>{item.title || item.name}</Text>

        <View style={styles.eventMeta}>
          <MaterialCommunityIcons
            name="calendar"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.eventMetaText}>
            {item.event_date ? formatDate(item.event_date) : "Đang cập nhật"}
          </Text>
        </View>

        <View style={styles.eventMeta}>
          <MaterialCommunityIcons
            name="map-marker"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.eventMetaText}>
            {item.venue || item.location || "Đang cập nhật địa điểm"}
          </Text>
        </View>

        {item.categories && item.categories.length > 0 && (
          <View style={styles.chipContainer}>
            {item.categories.map((category, index) => (
              <Chip key={index} style={styles.chip} textStyle={styles.chipText}>
                {category.name}
              </Chip>
            ))}
          </View>
        )}

        <Text numberOfLines={2} style={styles.eventDescription}>
          {item.description}
        </Text>

        <PaperButton
          mode="contained"
          onPress={() =>
            navigation.navigate("EventDetail", { eventId: item.id })
          }
          style={styles.actionButton}
          labelStyle={styles.buttonLabel}
        >
          Xem chi tiết
        </PaperButton>
      </View>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 16, color: COLORS.textSecondary }}>
          Đang tải danh sách sự kiện...
        </Text>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="calendar-alert"
          size={60}
          color={COLORS.error}
        />
        <Text style={styles.errorText}>{error}</Text>
        <PaperButton
          mode="contained"
          onPress={() => fetchEvents()}
          style={{ marginTop: 16, backgroundColor: COLORS.primary }}
        >
          Thử lại
        </PaperButton>
      </View>
    );
  }

  return (
    <View style={MyStyles.container}>
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text>Không có sự kiện nào.</Text>}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      />
    </View>
  );
};

export default Event;
