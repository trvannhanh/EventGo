import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { MyUserContext } from "../../configs/MyContexts";
import { authApis, endpoints } from "../../configs/Apis";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { useNavigation } from "@react-navigation/native";
import { Card, Title, Divider, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AnalyticsExport from "./AnalyticsExport";

const screenWidth = Dimensions.get("window").width;

const chartColors = [
  "#007bff",
  "#28a745",
  "#6f42c1",
  "#fd7e14",
  "#dc3545",
  "#17a2b8",
  "#6c757d",
  "#ffc107",
  "#20c997",
  "#e83e8c",
  "#5653fe",
  "#17a2b8",
  "#6610f2",
  "#ff6b6b",
  "#2dce89",
];

const AnalyticsScreen = () => {
  const user = useContext(MyUserContext);
  const [analyticsData, setAnalyticsData] = useState(null); 
  const [fullAnalyticsData, setFullAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOptions, setFilterOptions] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedEventFilter, setSelectedEventFilter] = useState("all");
  const [selectedOrganizerFilter, setSelectedOrganizerFilter] = useState("all");
  const loadFilterOptions = async () => {
    if (!user) return;

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const api = authApis(token);
      const res = await api.get(endpoints["analyticsFilterOptions"]);
      setFilterOptions(res.data);
    } catch (ex) {
      console.error("Error loading filter options:", ex);
    }
  };
  const loadAnalytics = async () => {
    if (!user) {
      setLoading(false);
      setError("Người dùng không tồn tại hoặc chưa đăng nhập.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setError("Không tìm thấy token xác thực. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }

      const api = authApis(token);

      const fullDataRes = await api.get(endpoints["dashboardAnalytics"]);
      setFullAnalyticsData(fullDataRes.data);

      const params = new URLSearchParams();
      if (user.role === "organizer" && selectedEventFilter !== "all") {
        params.append("event_filter", selectedEventFilter);
      } else if (user.role === "admin" && selectedOrganizerFilter !== "all") {
        params.append("organizer_filter", selectedOrganizerFilter);
      }

      const filteredUrl = params.toString()
        ? `${endpoints["dashboardAnalytics"]}?${params.toString()}`
        : endpoints["dashboardAnalytics"];
      const filteredRes = await api.get(filteredUrl);
      setAnalyticsData(filteredRes.data);
    } catch (ex) {
      console.error("Error loading dashboard analytics:", ex);
      setError("Lỗi khi tải dữ liệu phân tích. Vui lòng thử lại.");
      if (ex.response) {
        console.error("Response data:", ex.response.data);
        console.error("Response status:", ex.response.status);
        if (ex.response.status === 403) {
          setError("Bạn không có quyền truy cập vào mục này.");
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    if (user) {
      loadFilterOptions();
      loadAnalytics();
    }
  }, [user]);


  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const applyFilters = () => {
    setShowFilterModal(false);
    loadAnalytics();
  };
  const clearFilters = () => {
    setSelectedEventFilter("all");
    setSelectedOrganizerFilter("all");
    setTimeout(() => {
      loadAnalytics();
    }, 100);
  };

  if (loading && !refreshing) {
    return (
      <ActivityIndicator style={styles.loader} size="large" color="#007bff" />
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!analyticsData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Báo cáo thống kê</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <MaterialCommunityIcons name="filter" size={24} color="#007bff" />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text>Không có dữ liệu phân tích để hiển thị.</Text>
        </ScrollView>
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filterOptions={filterOptions}
          selectedEventFilter={selectedEventFilter}
          setSelectedEventFilter={setSelectedEventFilter}
          selectedOrganizerFilter={selectedOrganizerFilter}
          setSelectedOrganizerFilter={setSelectedOrganizerFilter}
          onApply={applyFilters}
          onClear={clearFilters}
          userRole={user?.role}
        />
      </View>
    );
  }
  if (user && user.role === "organizer") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Thống kê sự kiện</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <MaterialCommunityIcons name="filter" size={24} color="#007bff" />
          </TouchableOpacity>
        </View>        <OrganizerAnalytics
          data={analyticsData}
          fullData={fullAnalyticsData}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />{" "}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filterOptions={filterOptions}
          selectedEventFilter={selectedEventFilter}
          setSelectedEventFilter={setSelectedEventFilter}
          selectedOrganizerFilter={selectedOrganizerFilter}
          setSelectedOrganizerFilter={setSelectedOrganizerFilter}
          onApply={applyFilters}
          onClear={clearFilters}
          userRole={user?.role}
        />
      </View>
    );
  } else if (user && user.role === "admin") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Thống kê tổng quan</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <MaterialCommunityIcons name="filter" size={24} color="#007bff" />
          </TouchableOpacity>
        </View>        <AdminAnalytics
          data={analyticsData}
          fullData={fullAnalyticsData}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />{" "}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filterOptions={filterOptions}
          selectedEventFilter={selectedEventFilter}
          setSelectedEventFilter={setSelectedEventFilter}
          selectedOrganizerFilter={selectedOrganizerFilter}
          setSelectedOrganizerFilter={setSelectedOrganizerFilter}
          onApply={applyFilters}
          onClear={clearFilters}
          userRole={user?.role}
        />
      </View>
    );
  } else {
    return (
      <View style={styles.container}>
        <Text>Vai trò người dùng không được hỗ trợ cho tính năng này.</Text>
      </View>
    );
  }
};

const OrganizerAnalytics = ({ data, fullData, onRefresh, refreshing }) => {
  const navigation = useNavigation();
  const [chartType, setChartType] = useState("line");  

  const chartData = fullData || data;

  if (!data || data.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Thống kê sự kiện của bạn</Text>
        <Card style={styles.emptyCard}>
          <Card.Content>
            <MaterialCommunityIcons
              name="chart-line"
              size={48}
              color="#cccccc"
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>
              Chưa có dữ liệu sự kiện nào để phân tích.
            </Text>
            <Text style={styles.emptySubText}>
              Tạo sự kiện mới để xem thống kê!
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }
  const lineChartDataRevenue = {
    labels: chartData.map((event) => event.event_name.substring(0, 8) + "..."),
    datasets: [
      {
        data: chartData.map((event) => event.total_revenue || 0),
        color: (opacity = 1) => `rgba(40, 167, 69, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ["Doanh thu"],
  };
  const lineChartDataTickets = {
    labels: chartData.map((event) => event.event_name.substring(0, 8) + "..."),
    datasets: [
      {
        data: chartData.map((event) => event.tickets_sold || 0),
        color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ["Vé bán ra"],
  };

  const lineChartDataViews = {
    labels: chartData.map((event) => event.event_name.substring(0, 8) + "..."),
    datasets: [
      {
        data: chartData.map((event) => event.event_views || 0),
        color: (opacity = 1) => `rgba(111, 66, 193, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ["Lượt xem"],
  };
  const pieChartDataRevenue = {
    labels: chartData.map((event) => event.event_name.substring(0, 12) + "..."),
    data: chartData.map((event) => event.total_revenue || 0),
  };

  const pieChartDataTickets = {
    labels: chartData.map((event) => event.event_name.substring(0, 12) + "..."),
    data: chartData.map((event) => event.tickets_sold || 0),
  };

  const handleEventPress = (event) => {
    navigation.navigate("EventDetailAnalytics", {
      eventId: event.event_id,
      eventName: event.event_name,
    });
  };

  const navigateToCompare = () => {
    navigation.navigate("ComparativeAnalytics", {
      events: data,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Thống kê sự kiện của bạn</Text>
        <Text style={styles.subtitle}>Nhấn vào sự kiện để xem chi tiết</Text>
        <AnalyticsExport data={data} />
        {data.length >= 2 && (
          <TouchableOpacity
            onPress={navigateToCompare}
            style={styles.compareButton}
          >
            <MaterialCommunityIcons name="compare" size={16} color="#ffffff" />
            <Text style={styles.compareButtonText}>So sánh sự kiện</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.statsOverview}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data.length}</Text>
          <Text style={styles.statLabel}>Sự kiện</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {data.reduce((sum, event) => sum + (event.tickets_sold || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Tổng vé</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {(
              data.reduce((sum, event) => sum + (event.total_revenue || 0), 0) /
              1000
            ).toFixed(0)}
            K
          </Text>
          <Text style={styles.statLabel}>Doanh thu (VND)</Text>
        </View>
      </View>
      {data.map((event) => (
        <TouchableOpacity
          key={event.event_id}
          style={styles.card}
          onPress={() => handleEventPress(event)}
          activeOpacity={0.7}
        >
          <Card>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Title style={styles.eventName}>{event.event_name}</Title>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color="#007bff"
                />
              </View>
              <Divider style={styles.divider} />

              <View style={styles.cardGridStats}>
                <View style={styles.cardStatItem}>
                  <MaterialCommunityIcons
                    name="currency-usd"
                    size={20}
                    color="#28a745"
                  />
                  <Text style={styles.cardStatLabel}>Doanh thu</Text>
                  <Text style={styles.cardStatValue}>
                    {event.total_revenue
                      ? (event.total_revenue / 1000).toFixed(0) + "K"
                      : 0}
                  </Text>
                </View>

                <View style={styles.cardStatItem}>
                  <MaterialCommunityIcons
                    name="ticket-confirmation"
                    size={20}
                    color="#007bff"
                  />
                  <Text style={styles.cardStatLabel}>Vé bán ra</Text>
                  <Text style={styles.cardStatValue}>
                    {event.tickets_sold || 0}
                  </Text>
                </View>

                <View style={styles.cardStatItem}>
                  <MaterialCommunityIcons
                    name="eye"
                    size={20}
                    color="#6f42c1"
                  />
                  <Text style={styles.cardStatLabel}>Lượt xem</Text>
                  <Text style={styles.cardStatValue}>
                    {event.event_views || 0}
                  </Text>
                </View>

                <View style={styles.cardStatItem}>
                  <MaterialCommunityIcons
                    name="star"
                    size={20}
                    color="#fd7e14"
                  />
                  <Text style={styles.cardStatLabel}>Đánh giá</Text>
                  <Text style={styles.cardStatValue}>
                    {event.average_rating || 0}/5
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      ))}{" "}
      <View style={styles.chartTypeSelector}>
        <Text style={styles.sectionTitle}>Loại biểu đồ:</Text>
        <View style={styles.chartTypeBtnContainer}>
          <TouchableOpacity
            style={[
              styles.chartTypeBtn,
              chartType === "line" && styles.chartTypeSelected,
            ]}
            onPress={() => setChartType("line")}
          >
            <Text
              style={[
                styles.chartTypeBtnText,
                chartType === "line" && styles.chartTypeSelectedText,
              ]}
            >
              Đường
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.chartTypeBtn,
              chartType === "pie" && styles.chartTypeSelected,
            ]}
            onPress={() => setChartType("pie")}
          >
            <Text
              style={[
                styles.chartTypeBtnText,
                chartType === "pie" && styles.chartTypeSelectedText,
              ]}
            >
              Tròn
            </Text>
          </TouchableOpacity>
        </View>
        {/* <Text style={styles.chartTypeHint}>
                    * Biểu đồ đường tốt để xem xu hướng, biểu đồ tròn tốt để so sánh tỷ lệ
                </Text> */}
      </View>
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Doanh thu theo sự kiện (VND)</Text>
        {chartType === "line" ? (
          <LineChart
            style={styles.chart}
            data={lineChartDataRevenue}
            width={screenWidth - 40}
            height={250}
            yAxisLabel=""
            yAxisSuffix=" VND"
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(40, 167, 69, ${opacity})`,
            }}
            bezier
            formatYLabel={(yLabel) => parseInt(yLabel).toLocaleString("vi-VN")}
            horizontalLabelRotation={data.length > 6 ? 45 : 0}
          />
        ) : (
          <PieChart
            data={chartData.map((event, index) => ({
              name: event.event_name.substring(0, 12) + "...",
              population: event.total_revenue || 0,
              color: chartColors[index % chartColors.length],
              legendFontColor: "#7F7F7F",
              legendFontSize: 12,
            }))}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        )}
        {chartType === "line" && (
          <Text style={styles.chartSubtitle}>
            * Kéo ngang để xem tất cả sự kiện
          </Text>
        )}
      </View>
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Số vé bán ra theo sự kiện</Text>
        {chartType === "line" ? (
          <LineChart
            style={styles.chart}
            data={lineChartDataTickets}
            width={screenWidth - 40}
            height={250}
            yAxisLabel=""
            yAxisSuffix=" vé"
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
            }}
            bezier            horizontalLabelRotation={chartData.length > 6 ? 45 : 0}
          />
        ) : (
          <PieChart
            data={chartData.map((event, index) => ({
              name: event.event_name.substring(0, 12) + "...",
              population: event.tickets_sold || 0,
              color: chartColors[index % chartColors.length],
              legendFontColor: "#7F7F7F",
              legendFontSize: 12,
            }))}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        )}
        {chartType === "line" && (
          <Text style={styles.chartSubtitle}>
            * Kéo ngang để xem tất cả sự kiện
          </Text>
        )}
      </View>
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Lượt xem theo sự kiện</Text>
        {chartType === "line" ? (
          <LineChart
            style={styles.chart}
            data={lineChartDataViews}
            width={screenWidth - 40}
            height={250}
            yAxisLabel=""
            yAxisSuffix=" lượt"
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(111, 66, 193, ${opacity})`,
            }}
            bezier
            horizontalLabelRotation={data.length > 6 ? 45 : 0}
          />
        ) : (
          <PieChart
            data={chartData.map((event, index) => ({
              name: event.event_name.substring(0, 12) + "...",
              population: event.event_views || 0,
              color: chartColors[index % chartColors.length],
              legendFontColor: "#7F7F7F",
              legendFontSize: 12,
            }))}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        )}
        {chartType === "line" && (
          <Text style={styles.chartSubtitle}>
            * Kéo ngang để xem tất cả sự kiện
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const AdminAnalytics = ({ data, fullData, onRefresh, refreshing }) => {
  const [chartType, setChartType] = useState("bar");  

  const chartData = fullData || data;

  if (!data || data.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Thống kê theo Nhà tổ chức</Text>
        <Card style={styles.emptyCard}>
          <Card.Content>
            <MaterialCommunityIcons
              name="chart-bar"
              size={48}
              color="#cccccc"
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>
              Chưa có dữ liệu nhà tổ chức nào.
            </Text>
            <Text style={styles.emptySubText}>Hãy thêm người tổ chức mới!</Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }  const barChartDataRevenue = {
    labels: chartData.map((org) => org.organizer_username.substring(0, 10)),
    datasets: [{ data: chartData.map((org) => org.aggregated_total_revenue || 0) }],
  };

  const barChartDataTickets = {
    labels: chartData.map((org) => org.organizer_username.substring(0, 10)),
    datasets: [
      { data: chartData.map((org) => org.aggregated_total_tickets_sold || 0) },
    ],
  };

  const lineChartDataRevenue = {
    labels: chartData.map((org) => org.organizer_username.substring(0, 10)),
    datasets: [
      {
        data: chartData.map((org) => org.aggregated_total_revenue || 0),
        color: (opacity = 1) => `rgba(40, 167, 69, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ["Doanh thu"],
  };

  const lineChartDataTickets = {
    labels: chartData.map((org) => org.organizer_username.substring(0, 10)),
    datasets: [
      {
        data: chartData.map((org) => org.aggregated_total_tickets_sold || 0),
        color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ["Vé bán ra"],
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {" "}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Thống kê theo Nhà tổ chức</Text>
        <Text style={styles.subtitle}>
          Tổng hợp phân tích theo từng nhà tổ chức
        </Text>
        <AnalyticsExport data={data} />
      </View>
      <View style={styles.statsOverview}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data.length}</Text>
          <Text style={styles.statLabel}>Nhà tổ chức</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {data.reduce((sum, org) => sum + (org.total_events || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Tổng sự kiện</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {(
              data.reduce(
                (sum, org) => sum + (org.aggregated_total_revenue || 0),
                0
              ) / 1000
            ).toFixed(0)}
            K
          </Text>
          <Text style={styles.statLabel}>Doanh thu (VND)</Text>
        </View>
      </View>
      {data.map((organizer) => (
        <Card key={organizer.organizer_id} style={styles.organizerCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View>
                <Title style={styles.organizerName}>
                  {organizer.organizer_username}
                </Title>
                <Text style={styles.organizerEmail}>
                  {organizer.organizer_email}
                </Text>
              </View>
              <View style={styles.organizerRating}>
                <MaterialCommunityIcons name="star" size={18} color="#fd7e14" />
                <Text style={styles.ratingText}>
                  {organizer.average_event_rating || 0}/5
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.cardGridStats}>
              <View style={styles.cardStatItem}>
                <MaterialCommunityIcons
                  name="calendar-multiple"
                  size={20}
                  color="#007bff"
                />
                <Text style={styles.cardStatLabel}>Sự kiện</Text>
                <Text style={styles.cardStatValue}>
                  {organizer.total_events || 0}
                </Text>
              </View>

              <View style={styles.cardStatItem}>
                <MaterialCommunityIcons
                  name="currency-usd"
                  size={20}
                  color="#28a745"
                />
                <Text style={styles.cardStatLabel}>Doanh thu</Text>
                <Text style={styles.cardStatValue}>
                  {organizer.aggregated_total_revenue
                    ? (organizer.aggregated_total_revenue / 1000).toFixed(0) +
                      "K"
                    : 0}
                </Text>
              </View>

              <View style={styles.cardStatItem}>
                <MaterialCommunityIcons
                  name="ticket-confirmation"
                  size={20}
                  color="#6610f2"
                />
                <Text style={styles.cardStatLabel}>Vé bán ra</Text>
                <Text style={styles.cardStatValue}>
                  {organizer.aggregated_total_tickets_sold || 0}
                </Text>
              </View>

              <View style={styles.cardStatItem}>
                <MaterialCommunityIcons name="eye" size={20} color="#6f42c1" />
                <Text style={styles.cardStatLabel}>Lượt xem</Text>
                <Text style={styles.cardStatValue}>
                  {organizer.total_event_views || 0}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ))}
      <View style={styles.chartTypeSelector}>
        <Text style={styles.sectionTitle}>Loại biểu đồ:</Text>
        <View style={styles.chartTypeBtnContainer}>
          <TouchableOpacity
            style={[
              styles.chartTypeBtn,
              chartType === "bar" && styles.chartTypeSelected,
            ]}
            onPress={() => setChartType("bar")}
          >
            <Text
              style={[
                styles.chartTypeBtnText,
                chartType === "bar" && styles.chartTypeSelectedText,
              ]}
            >
              Cột
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.chartTypeBtn,
              chartType === "line" && styles.chartTypeSelected,
            ]}
            onPress={() => setChartType("line")}
          >
            <Text
              style={[
                styles.chartTypeBtnText,
                chartType === "line" && styles.chartTypeSelectedText,
              ]}
            >
              Đường
            </Text>
          </TouchableOpacity>
        </View>
        {/* <Text style={styles.chartTypeHint}>
                    * Biểu đồ cột tốt để so sánh giá trị, biểu đồ đường tốt để xem xu hướng
                </Text> */}
      </View>
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>
          Tổng doanh thu theo Nhà tổ chức (VND)
        </Text>
        {chartType === "bar" ? (
          <BarChart
            style={styles.chart}
            data={barChartDataRevenue}
            width={screenWidth - 40}
            height={250}
            yAxisLabel=""
            yAxisSuffix=" VND"
            chartConfig={chartConfig}
            verticalLabelRotation={30}
            fromZero={true}
            formatYLabel={(yLabel) => parseInt(yLabel).toLocaleString("vi-VN")}
          />
        ) : (
          <LineChart
            style={styles.chart}
            data={lineChartDataRevenue}
            width={screenWidth - 40}
            height={250}
            yAxisLabel=""
            yAxisSuffix=" VND"
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(40, 167, 69, ${opacity})`,
            }}            bezier
            formatYLabel={(yLabel) => parseInt(yLabel).toLocaleString("vi-VN")}
            horizontalLabelRotation={chartData.length > 6 ? 45 : 30}
          />
        )}
        {chartData.length > 6 && (
          <Text style={styles.chartSubtitle}>
            * Kéo ngang để xem tất cả nhà tổ chức
          </Text>
        )}
      </View>{" "}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Tổng vé bán theo Nhà tổ chức</Text>
        {chartType === "bar" ? (
          <BarChart
            style={styles.chart}
            data={barChartDataTickets}
            width={screenWidth - 40}
            height={250}
            yAxisLabel=""
            yAxisSuffix=" vé"
            chartConfig={chartConfig}
            verticalLabelRotation={30}
            fromZero={true}
            formatYLabel={(yLabel) => parseInt(yLabel).toLocaleString("vi-VN")}
          />
        ) : (
          <LineChart
            style={styles.chart}
            data={lineChartDataTickets}
            width={screenWidth - 40}
            height={250}
            yAxisLabel=""
            yAxisSuffix=" vé"
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
            }}
            bezier
            horizontalLabelRotation={chartData.length > 6 ? 45 : 30}
          />
        )}
        {chartData.length > 6 && (
          <Text style={styles.chartSubtitle}>
            * Kéo ngang để xem tất cả nhà tổ chức
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const FilterModal = ({
  visible,
  onClose,
  filterOptions,
  selectedEventFilter,
  setSelectedEventFilter,
  selectedOrganizerFilter,
  setSelectedOrganizerFilter,
  onApply,
  onClear,
  userRole,
}) => {
  if (!filterOptions) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bộ lọc báo cáo</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>{" "}
          <ScrollView style={styles.modalBody}>
            {/* Event Filter - chỉ hiển thị cho Organizer */}
            {userRole === "organizer" && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Chọn sự kiện:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedEventFilter}
                    onValueChange={setSelectedEventFilter}
                    style={styles.picker}
                  >
                    <Picker.Item label="Tất cả sự kiện" value="all" />
                    {filterOptions.events?.map((event) => (
                      <Picker.Item
                        key={event.id}
                        label={event.name}
                        value={event.id.toString()}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {/* Organizer Filter - chỉ hiển thị cho Admin */}
            {userRole === "admin" && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Chọn nhà tổ chức:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedOrganizerFilter}
                    onValueChange={setSelectedOrganizerFilter}
                    style={styles.picker}
                  >
                    <Picker.Item label="Tất cả nhà tổ chức" value="all" />
                    {filterOptions.organizers?.map((organizer) => (
                      <Picker.Item
                        key={organizer.id}
                        label={organizer.username}
                        value={organizer.id.toString()}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button
              mode="outlined"
              onPress={onClear}
              style={styles.clearButton}
            >
              Xóa bộ lọc
            </Button>
            <Button
              mode="contained"
              onPress={onApply}
              style={styles.applyButton}
            >
              Áp dụng
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const chartConfig = {
  backgroundColor: "#ffffff",
  backgroundGradientFrom: "#ffffff",
  backgroundGradientFromOpacity: 0.8,
  backgroundGradientTo: "#ffffff",
  backgroundGradientToOpacity: 1,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(50, 50, 50, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  barPercentage: 0.7,
  propsForBackgroundLines: {
    strokeDasharray: "",
    stroke: "#e3e3e3",
  },
  propsForLabels: {
    fontSize: 9,
  },
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#f4f6f8",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f6f8",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    fontSize: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  eventName: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
    color: "#007bff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  viewDetails: {
    fontSize: 13,
    color: "#007bff",
  },
  chartContainer: {
    marginTop: 20,
    marginBottom: 10,
    alignItems: "center",
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
    color: "#444",
  },
  chartSubtitle: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#666",
    textAlign: "center",
    marginTop: 5,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
  statsOverview: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007bff",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  cardGridStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cardStatItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 10,
  },
  cardStatLabel: {
    fontSize: 12,
    color: "#666",
  },
  cardStatValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  divider: {
    marginVertical: 10,
  },
  legendText: {
    fontSize: 12,
    color: "#666",
  },
  compareButton: {
    backgroundColor: "#007bff",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  compareButtonText: {
    color: "#ffffff",
    marginLeft: 6,
    fontWeight: "600",
    fontSize: 14,
  },
  chartTypeSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginRight: 10,
  },
  chartTypeBtnContainer: {
    flexDirection: "row",
  },
  chartTypeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: "#f0f0f0",
  },
  chartTypeSelected: {
    backgroundColor: "#007bff",
  },
  chartTypeBtnText: {
    fontSize: 14,
    color: "#666",
  },
  chartTypeSelectedText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  chartTypeHint: {
    fontSize: 11,
    fontStyle: "italic",
    color: "#666",
    textAlign: "center",
    marginTop: 5,
  },
  
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: screenWidth * 0.9,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  picker: {
    height: 50,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    backgroundColor: "#f8f9fa",
  },
  dateText: {
    fontSize: 16,
    color: "#666",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  clearButton: {
    flex: 1,
    marginRight: 10,
  },
  applyButton: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: "#007bff",
  },
});

export default AnalyticsScreen;
