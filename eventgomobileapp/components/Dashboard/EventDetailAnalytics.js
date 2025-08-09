import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Dimensions, RefreshControl, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApis, endpoints } from '../../configs/Apis';
import { BarChart, LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { format } from 'date-fns';
import { Card, Title, Paragraph, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AnalyticsExport from './AnalyticsExport';

const screenWidth = Dimensions.get('window').width;

const EventDetailAnalytics = ({ route, navigation }) => {
    const { eventId, eventName } = route.params;
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    
    useEffect(() => {
        navigation.setOptions({
            title: 'Phân tích: ' + (eventName?.substring(0, 20) + (eventName?.length > 20 ? '...' : '') || 'Sự kiện'),
            headerShown: true
        });
        
        loadEventAnalytics();
    }, [eventId]);
    
    const loadEventAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                setError("Không tìm thấy token xác thực. Vui lòng đăng nhập lại.");
                setLoading(false);
                return;
            }
            
            const api = authApis(token);
            const res = await api.get(endpoints.eventAnalytics(eventId));
            
            setAnalyticsData(res.data);
        } catch (ex) {
            console.error("Error loading event analytics:", ex);
            setError("Lỗi khi tải dữ liệu phân tích sự kiện. Vui lòng thử lại.");
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
    
    const onRefresh = () => {
        setRefreshing(true);
        loadEventAnalytics();
    };
    
    if (loading && !refreshing) {
        return <ActivityIndicator style={styles.loader} size="large" color="#007bff" />;
    }
    
    if (error) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                    style={styles.refreshButton} 
                    onPress={onRefresh}
                >
                    <Text style={styles.refreshButtonText}>Thử lại</Text>
                </TouchableOpacity>
            </View>
        );
    }
    
    if (!analyticsData) {
        return (
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Text>Không có dữ liệu phân tích chi tiết cho sự kiện này.</Text>
            </ScrollView>
        );
    }
    
    const ticketTypes = analyticsData.tickets_breakdown || [];
    const pieChartData = ticketTypes.map((ticket, index) => {
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
            '#FF9F40', '#8AC926', '#1982C4', '#6A4C93', '#F94144'
        ];
        
        return {
            name: ticket.ticket_type,
            quantity: ticket.quantity_sold,
            color: colors[index % colors.length],
            legendFontColor: '#7F7F7F',
            legendFontSize: 12
        };
    });

    const viewsData = analyticsData.views_by_day || [];
    const lineChartData = {
        labels: viewsData.map(item => format(new Date(item.date), 'dd/MM')),
        datasets: [{
            data: viewsData.map(item => item.count),
            color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
            strokeWidth: 2
        }]
    };
    
    const progressData = {
        labels: ["Chuyển đổi", "Đánh giá", "Quan tâm"],
        data: [
            analyticsData.conversion_rate ? analyticsData.conversion_rate / 100 : 0,
            analyticsData.average_rating ? analyticsData.average_rating / 5 : 0,
            analyticsData.event_interest_score ? Math.min(analyticsData.event_interest_score / 100, 1) : 0
        ]
    };
    
    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.headerContainer}>
                <Text style={styles.title}>{analyticsData.event_name}</Text>
                <Text style={styles.subtitle}>
                    {analyticsData.event_start_date ? format(new Date(analyticsData.event_start_date), 'dd/MM/yyyy') : ''}
                    {analyticsData.event_end_date ? ` - ${format(new Date(analyticsData.event_end_date), 'dd/MM/yyyy')}` : ''}
                </Text>
                <AnalyticsExport data={analyticsData} isEventDetail={true} eventName={analyticsData.event_name} />
            </View>
            
            <View style={styles.statsGrid}>
                <Surface style={styles.statCard}>
                    <MaterialCommunityIcons name="ticket-confirmation" size={24} color="#007bff" />
                    <Text style={styles.statValue}>{analyticsData.tickets_sold || 0}</Text>
                    <Text style={styles.statLabel}>Vé bán ra</Text>
                </Surface>
                
                <Surface style={styles.statCard}>
                    <MaterialCommunityIcons name="currency-usd" size={24} color="#28a745" />
                    <Text style={styles.statValue}>
                        {analyticsData.total_revenue ? (analyticsData.total_revenue / 1000).toFixed(1) + 'K' : '0'}
                    </Text>
                    <Text style={styles.statLabel}>Doanh thu (VND)</Text>
                </Surface>
                
                <Surface style={styles.statCard}>
                    <MaterialCommunityIcons name="eye" size={24} color="#6f42c1" />
                    <Text style={styles.statValue}>{analyticsData.event_views || 0}</Text>
                    <Text style={styles.statLabel}>Lượt xem</Text>
                </Surface>
                
                <Surface style={styles.statCard}>
                    <MaterialCommunityIcons name="star" size={24} color="#fd7e14" />
                    <Text style={styles.statValue}>{analyticsData.average_rating || 0}/5</Text>
                    <Text style={styles.statLabel}>Đánh giá TB</Text>
                </Surface>
            </View>
            
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Chỉ số Quan tâm</Title>
                    <View style={styles.interestScoreBox}>
                        <Text style={styles.interestScoreValue}>{analyticsData.event_interest_score || 0}</Text>
                        <Text style={styles.interestScoreLabel}>Điểm</Text>
                    </View>
                    <Paragraph style={styles.interestDescription}>
                        Chỉ số này thể hiện mức độ quan tâm của người dùng đến sự kiện của bạn, 
                        dựa trên lượt xem, lượt lưu và các tương tác khác.
                    </Paragraph>
                </Card.Content>
            </Card>
            
            {pieChartData.length > 0 && (
                <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>Phân bố số lượng vé đã bán</Text>
                    <PieChart
                        data={pieChartData}
                        width={screenWidth - 40}
                        height={220}
                        chartConfig={chartConfig}
                        accessor="quantity"
                        backgroundColor="transparent"
                        paddingLeft="15"
                        absolute
                    />
                </View>
            )}
            
            {viewsData.length > 0 && (
                <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>Lượt xem theo ngày</Text>
                    <LineChart
                        data={lineChartData}
                        width={screenWidth - 40}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                    />
                </View>
            )}
            
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Các chỉ số hiệu suất</Text>
                <ProgressChart
                    data={progressData}
                    width={screenWidth - 40}
                    height={220}
                    strokeWidth={16}
                    radius={32}
                    chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) => `rgba(81, 138, 78, ${opacity})`,
                    }}
                    hideLegend={false}
                    style={styles.chart}
                />
                <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, {backgroundColor: 'rgba(81, 138, 78, 0.8)'}]} />
                        <Text style={styles.legendText}>Chuyển đổi: {analyticsData.conversion_rate || 0}%</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, {backgroundColor: 'rgba(81, 138, 78, 0.8)'}]} />
                        <Text style={styles.legendText}>Đánh giá: {analyticsData.average_rating || 0}/5</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, {backgroundColor: 'rgba(81, 138, 78, 0.8)'}]} />
                        <Text style={styles.legendText}>Quan tâm: {analyticsData.event_interest_score || 0}/100</Text>
                    </View>
                </View>
            </View>
            
            <Card style={styles.card}>
                <Card.Content>
                    <Title>Các chỉ số khác</Title>
                    <View style={styles.metricRow}>
                        <View style={styles.metricItem}>
                            <MaterialCommunityIcons name="account-convert" size={24} color="#6c757d" />
                            <Text style={styles.metricLabel}>Tỷ lệ chuyển đổi</Text>
                            <Text style={styles.metricValue}>
                                {analyticsData.conversion_rate ? analyticsData.conversion_rate.toFixed(1) : '0'}%
                            </Text>
                        </View>
                        
                        <View style={styles.metricItem}>
                            <MaterialCommunityIcons name="close-circle" size={24} color="#dc3545" />
                            <Text style={styles.metricLabel}>Tỷ lệ hủy</Text>
                            <Text style={styles.metricValue}>
                                {analyticsData.cancellation_rate ? analyticsData.cancellation_rate.toFixed(1) : '0'}%
                            </Text>
                        </View>
                    </View>
                </Card.Content>
            </Card>
            
            <Card style={[styles.card, styles.lastCard]}>
                <Card.Content>
                    <Title>Lượt đánh giá ({analyticsData.review_count || 0})</Title>
                    <View style={styles.ratingDistribution}>
                        <View style={styles.ratingRow}>
                            <Text style={styles.ratingLabel}>5 sao</Text>
                            <View style={styles.ratingBar}>
                                <View 
                                    style={[
                                        styles.ratingFill, 
                                        {
                                            width: `${analyticsData.rating_5_percent || 0}%`,
                                            backgroundColor: '#28a745'
                                        }
                                    ]} 
                                />
                            </View>
                            <Text style={styles.ratingPercent}>{analyticsData.rating_5_percent || 0}%</Text>
                        </View>
                        <View style={styles.ratingRow}>
                            <Text style={styles.ratingLabel}>4 sao</Text>
                            <View style={styles.ratingBar}>
                                <View 
                                    style={[
                                        styles.ratingFill, 
                                        {
                                            width: `${analyticsData.rating_4_percent || 0}%`,
                                            backgroundColor: '#4db846'
                                        }
                                    ]} 
                                />
                            </View>
                            <Text style={styles.ratingPercent}>{analyticsData.rating_4_percent || 0}%</Text>
                        </View>
                        <View style={styles.ratingRow}>
                            <Text style={styles.ratingLabel}>3 sao</Text>
                            <View style={styles.ratingBar}>
                                <View 
                                    style={[
                                        styles.ratingFill, 
                                        {
                                            width: `${analyticsData.rating_3_percent || 0}%`,
                                            backgroundColor: '#ffc107'
                                        }
                                    ]} 
                                />
                            </View>
                            <Text style={styles.ratingPercent}>{analyticsData.rating_3_percent || 0}%</Text>
                        </View>
                        <View style={styles.ratingRow}>
                            <Text style={styles.ratingLabel}>2 sao</Text>
                            <View style={styles.ratingBar}>
                                <View 
                                    style={[
                                        styles.ratingFill, 
                                        {
                                            width: `${analyticsData.rating_2_percent || 0}%`,
                                            backgroundColor: '#fd7e14'
                                        }
                                    ]} 
                                />
                            </View>
                            <Text style={styles.ratingPercent}>{analyticsData.rating_2_percent || 0}%</Text>
                        </View>
                        <View style={styles.ratingRow}>
                            <Text style={styles.ratingLabel}>1 sao</Text>
                            <View style={styles.ratingBar}>
                                <View 
                                    style={[
                                        styles.ratingFill, 
                                        {
                                            width: `${analyticsData.rating_1_percent || 0}%`,
                                            backgroundColor: '#dc3545'
                                        }
                                    ]} 
                                />
                            </View>
                            <Text style={styles.ratingPercent}>{analyticsData.rating_1_percent || 0}%</Text>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        </ScrollView>
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
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8',
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f4f6f8',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        fontSize: 16,
        marginTop: 20,
    },
    refreshButton: {
        backgroundColor: '#007bff',
        padding: 12,
        borderRadius: 8,
        marginTop: 20,
        alignSelf: 'center',
    },
    refreshButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    headerContainer: {
        backgroundColor: '#fff',
        padding: 20,
        marginBottom: 10,
        borderRadius: 10,
        marginHorizontal: 16,
        marginTop: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginBottom: 16,
    },
    statCard: {
        width: '48%',
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 16,
        borderRadius: 10,
        alignItems: 'center',
        elevation: 3,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
    },
    card: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 10,
        elevation: 3,
    },
    lastCard: {
        marginBottom: 25,
    },
    interestScoreBox: {
        alignItems: 'center',
        margin: 16,
    },
    interestScoreValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#007bff',
    },
    interestScoreLabel: {
        fontSize: 14,
        color: '#666',
    },
    interestDescription: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    chartContainer: {
        backgroundColor: '#fff',
        padding: 15,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        elevation: 3,
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#444',
        textAlign: 'center',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    metricItem: {
        alignItems: 'center',
        width: '48%',
    },
    metricLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 8,
        textAlign: 'center',
    },
    metricValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 5,
    },
    ratingDistribution: {
        marginTop: 16,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    ratingLabel: {
        width: 50,
        fontSize: 14,
        color: '#666',
    },
    ratingBar: {
        flex: 1,
        height: 10,
        backgroundColor: '#e9ecef',
        borderRadius: 5,
        marginHorizontal: 10,
    },
    ratingFill: {
        height: '100%',
        borderRadius: 5,
    },
    ratingPercent: {
        width: 40,
        fontSize: 14,
        color: '#666',
        textAlign: 'right',
    },
    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        marginTop: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    legendColor: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 6,
    },
    legendText: {
        fontSize: 12,
        color: '#666',
    },
});

export default EventDetailAnalytics;
