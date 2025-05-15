// import React, { useEffect, useState, useCallback } from 'react';
// import { ScrollView, ActivityIndicator, View, Alert, Text, Image, Linking, StyleSheet, RefreshControl, Platform } from 'react-native';
// import { Button, Card, Title, Paragraph, RadioButton, TextInput, Divider, Chip, Surface, IconButton, HelperText, Portal, Modal } from 'react-native-paper';
// import api, { endpoints } from '../../configs/Apis';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { authApis } from '../../configs/Apis';
// import { MaterialCommunityIcons } from '@expo/vector-icons';
// import { COLORS } from '../../components/styles/MyStyles';
// import QRCode from 'react-native-qrcode-svg';

// const BookTicket = ({ route, navigation }) => {
//     const { eventId, ticketTypeId, quantity: initialQuantity = "1" } = route.params || {};
//     const [event, setEvent] = useState(null);
//     const [tickets, setTickets] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [selectedTicket, setSelectedTicket] = useState(ticketTypeId || "");
//     const [quantity, setQuantity] = useState(initialQuantity.toString());
//     const [discount, setDiscount] = useState("");
//     const [paymentMethod, setPaymentMethod] = useState("MoMo");
//     const [booking, setBooking] = useState(false);
//     const [momoQrUrl, setMomoQrUrl] = useState(null);
//     const [momoPayUrl, setMomoPayUrl] = useState(null);
//     const [orderId, setOrderId] = useState(null);
//     const [qrImages, setQrImages] = useState([]);
//     const styles = StyleSheet.create({
//         container: {
//             flex: 1,
//             backgroundColor: COLORS.background,
//             padding: 16,
//         },
//         scrollContent: {
//             flexGrow: 1,
//         },
//         header: {
//             marginBottom: 20,
//         },
//         title: {
//             fontSize: 24,
//             fontWeight: 'bold',
//             color: COLORS.primary,
//             marginBottom: 8,
//         },
//         subtitle: {
//             fontSize: 16,
//             color: COLORS.textSecondary,
//             marginBottom: 16,
//         },
//         card: {
//             marginBottom: 16,
//             backgroundColor: COLORS.background,
//             borderRadius: 12,
//         },
//         eventImage: {
//             width: '100%',
//             height: 180,
//             borderTopLeftRadius: 12,
//             borderTopRightRadius: 12,
//         },
//         eventImagePlaceholder: {
//             width: '100%',
//             height: 180,
//             borderTopLeftRadius: 12,
//             borderTopRightRadius: 12,
//             backgroundColor: COLORS.primaryLight,
//             justifyContent: 'center',
//             alignItems: 'center',
//         },
//         eventDetails: {
//             padding: 16,
//         },
//         eventName: {
//             fontSize: 20,
//             fontWeight: 'bold',
//             color: COLORS.text,
//             marginBottom: 8,
//         },
//         eventInfo: {
//             flexDirection: 'row',
//             alignItems: 'center',
//             marginBottom: 8,
//         },
//         eventInfoText: {
//             marginLeft: 8,
//             fontSize: 14,
//             color: COLORS.textSecondary,
//         },
//         ticketSection: {
//             marginVertical: 16,
//         },
//         sectionTitle: {
//             fontSize: 18,
//             fontWeight: 'bold',
//             color: COLORS.primary,
//             marginBottom: 12,
//         },
//         ticketOption: {
//             marginBottom: 12,
//             padding: 16,
//             borderRadius: 8,
//             borderWidth: 1,
//             flexDirection: 'row',
//             alignItems: 'center',
//         },
//         selectedTicket: {
//             borderColor: COLORS.primary,
//             backgroundColor: COLORS.primaryLight + '20',
//         },
//         unselectedTicket: {
//             borderColor: COLORS.border,
//         },
//         ticketInfo: {
//             flex: 1,
//             marginLeft: 12,
//         },
//         ticketType: {
//             fontSize: 16,
//             fontWeight: 'bold',
//             color: COLORS.text,
//         },
//         ticketPrice: {
//             fontSize: 14,
//             color: COLORS.primary,
//             fontWeight: 'bold',
//             marginTop: 4,
//         },
//         ticketDescription: {
//             fontSize: 12,
//             color: COLORS.textSecondary,
//             marginTop: 4,
//         },
//         quantityContainer: {
//             flexDirection: 'row',
//             alignItems: 'center',
//             justifyContent: 'center',
//             marginVertical: 16,
//         },
//         quantityInput: {
//             width: 100,
//             textAlign: 'center',
//             marginHorizontal: 8,
//             backgroundColor: COLORS.background,
//             height: 45,
//         },
//         discountContainer: {
//             marginVertical: 16,
//         },
//         discountInput: {
//             backgroundColor: COLORS.background,
//         },
//         totalContainer: {
//             padding: 16,
//             backgroundColor: COLORS.background,
//             borderRadius: 8,
//             marginVertical: 16,
//             borderWidth: 1,
//             borderColor: COLORS.border,
//         },
//         totalRow: {
//             flexDirection: 'row',
//             justifyContent: 'space-between',
//             marginBottom: 8,
//         },
//         totalLabel: {
//             fontSize: 14,
//             color: COLORS.textSecondary,
//         },
//         totalValue: {
//             fontSize: 14,
//             fontWeight: 'bold',
//             color: COLORS.text,
//         },
//         grandTotal: {
//             fontSize: 18,
//             fontWeight: 'bold',
//             color: COLORS.primary,
//         },
//         paymentSection: {
//             marginVertical: 16,
//         },
//         paymentOption: {
//             flexDirection: 'row',
//             alignItems: 'center',
//             padding: 16,
//             borderRadius: 8,
//             borderWidth: 1,
//             marginBottom: 12,
//         },
//         paymentLogo: {
//             width: 40,
//             height: 40,
//             marginRight: 12,
//         },
//         paymentInfo: {
//             flex: 1,
//         },
//         paymentName: {
//             fontSize: 16,
//             fontWeight: 'bold',
//         },
//         paymentDescription: {
//             fontSize: 12,
//             color: COLORS.textSecondary,
//         },
//         bookButton: {
//             marginVertical: 20,
//             paddingVertical: 6,
//             backgroundColor: COLORS.primary,
//         },
//         orderConfirmContainer: {
//             alignItems: 'center',
//             padding: 16,
//         },
//         successIcon: {
//             marginBottom: 16,
//         },
//         orderTitle: {
//             fontSize: 20,
//             fontWeight: 'bold',
//             color: COLORS.primary,
//             marginBottom: 8,
//         },
//         orderDetail: {
//             fontSize: 14,
//             color: COLORS.textSecondary,
//             marginBottom: 8,
//             textAlign: 'center',
//         },
//         qrContainer: {
//             marginVertical: 24,
//             padding: 16,
//             backgroundColor: 'white',
//             borderRadius: 8,
//             alignItems: 'center',
//         },
//         momoQrImage: {
//             width: 250,
//             height: 250,
//             marginVertical: 16,
//         },
//         loadingContainer: {
//             flex: 1,
//             justifyContent: 'center',
//             alignItems: 'center',
//             padding: 20,
//         },
//         loadingText: {
//             marginTop: 16,
//             color: COLORS.textSecondary,
//         },
//         modalContent: {
//             backgroundColor: 'white',
//             padding: 20,
//             margin: 20,
//             borderRadius: 12,
//         },
//         modalTitle: {
//             fontSize: 18,
//             fontWeight: 'bold',
//             color: COLORS.primary,
//             marginBottom: 16,
//             textAlign: 'center',
//         },
//         modalText: {
//             fontSize: 14,
//             color: COLORS.text,
//             lineHeight: 20,
//             marginBottom: 16,
//             textAlign: 'center',
//         },
//         modalButton: {
//             marginTop: 16,
//             backgroundColor: COLORS.primary,
//         },
//     });    useEffect(() => {
//         const fetchEvent = async () => {
//             try {
//                 if (!eventId) {
//                     throw new Error("Event ID is required");
//                 }
                
//                 const res = await api.get(endpoints.eventDetail(eventId));
//                 setEvent(res.data);
                
//                 const ticketRes = await api.get(endpoints.ticketsOfEvent(eventId));
//                 setTickets(ticketRes.data);
                
//                 // If ticketTypeId was passed, make sure it's in the available tickets
//                 if (ticketTypeId && !ticketRes.data.some(t => t.id === ticketTypeId)) {
//                     setSelectedTicket("");
//                 }
//             } catch (err) {
//                 console.error("Error fetching event data:", err);
//                 setEvent(null);
//                 Alert.alert(
//                     "Lỗi",
//                     "Không thể tải thông tin sự kiện. Vui lòng thử lại sau.",
//                     [
//                         {
//                             text: "Quay lại",
//                             onPress: () => navigation.goBack()
//                         }
//                     ]
//                 );
//             } finally {
//                 setLoading(false);
//             }
//         };
        
//         fetchEvent();
//     }, [eventId, ticketTypeId, navigation]);const handleBookTicket = async () => {
//         if (!selectedTicket) {
//             Alert.alert('Lỗi', 'Vui lòng chọn loại vé!');
//             return;
//         }
        
//         if (!quantity || quantity <= 0) {
//             Alert.alert('Lỗi', 'Vui lòng nhập số lượng vé hợp lệ');
//             return;
//         }
        
//         if (!paymentMethod) {
//             Alert.alert('Lỗi', 'Vui lòng chọn phương thức thanh toán');
//             return;
//         }
        
//         setBooking(true);
//         try {
//             const token = await AsyncStorage.getItem('token');
//             if (!token) {
//                 Alert.alert(
//                     'Chưa đăng nhập', 
//                     'Vui lòng đăng nhập để tiếp tục', 
//                     [
//                         { 
//                             text: 'Đăng nhập', 
//                             onPress: () => navigation.navigate('login') 
//                         },
//                         { 
//                             text: 'Hủy', 
//                             style: 'cancel' 
//                         }
//                     ]
//                 );
//                 setBooking(false);
//                 return;
//             }
            
//             const res = await authApis(token).post(endpoints.bookTicket(eventId), {
//                 ticket_id: selectedTicket,
//                 quantity: parseInt(quantity),
//                 payment_method: paymentMethod,
//                 discount_code: discount || undefined,
//             });
            
//             if (res.data && res.data.qrCodeUrl) {
//                 // console.log('MoMo QR URL:', res.data.qrCodeUrl);
//                 setMomoQrUrl(res.data.qrCodeUrl);
//                 setMomoPayUrl(res.data.payUrl);
//             }            if (res.data && res.data.order_id) {
//                 setOrderId(res.data.order_id);
//                 // Lấy mã QR từ đơn hàng (nếu đã thanh toán thành công)
//                 const orderRes = await authApis(token).get(`orders/${res.data.order_id}/`);
//                 setQrImages(orderRes.data.qr_image_urls || []);
//             }
            
//             Alert.alert(
//                 'Đặt vé thành công', 
//                 'Vui lòng quét mã QR MoMo để thanh toán. Sau khi thanh toán thành công, mã QR vé sẽ được gửi cho bạn.',
//                 [
//                     {
//                         text: 'Đã hiểu',
//                         onPress: () => console.log('Payment acknowledged')
//                     }
//                 ]
//             );
//         } catch (err) {
//             console.error('Booking error:', err);
//             const errorMessage = err.response?.data?.detail || 
//                                  err.response?.data?.error || 
//                                  'Đã xảy ra lỗi khi đặt vé. Vui lòng thử lại sau.';
            
//             Alert.alert(
//                 'Đặt vé thất bại!', 
//                 errorMessage,
//                 [
//                     {
//                         text: 'Đóng',
//                         style: 'cancel'
//                     }
//                 ]
//             );
//         } finally {
//             setBooking(false);
//         }
//     };    if (loading) {
//         return (
//             <View style={styles.loadingContainer}>
//                 <ActivityIndicator size="large" color={COLORS.primary} />
//                 <Text style={styles.loadingText}>Đang tải thông tin sự kiện...</Text>
//             </View>
//         );
//     }
    
//     if (!event) {
//         return (
//             <View style={styles.loadingContainer}>
//                 <MaterialCommunityIcons name="alert-circle" size={60} color={COLORS.error} />
//                 <Text style={{ marginTop: 16, color: COLORS.error, textAlign: 'center' }}>
//                     Không tìm thấy thông tin sự kiện. Sự kiện có thể đã bị xóa hoặc không tồn tại.
//                 </Text>
//                 <Button 
//                     mode="contained" 
//                     onPress={() => navigation.goBack()} 
//                     style={{ marginTop: 20, backgroundColor: COLORS.primary }}
//                 >
//                     Quay lại
//                 </Button>
//             </View>
//         );
//     }return (
//         <ScrollView 
//             style={styles.container}
//             contentContainerStyle={styles.scrollContent}
//         >
//             <Surface style={[styles.card, { elevation: 2 }]}>
//                 <View style={styles.header}>
//                     <Text style={styles.title}>Đặt vé sự kiện</Text>
//                     <Text style={styles.subtitle}>{event.name}</Text>
//                 </View>
                
//                 <View style={styles.eventDetails}>
//                     <View style={styles.eventInfo}>
//                         <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
//                         <Text style={styles.eventInfoText}>
//                             {event.event_date ? new Date(event.event_date).toLocaleDateString('vi-VN') : 'Đang cập nhật'}
//                         </Text>
//                     </View>
                    
//                     <View style={styles.eventInfo}>
//                         <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
//                         <Text style={styles.eventInfoText}>
//                             {event.event_time ? event.event_time.substring(0, 5) : 'Đang cập nhật'}
//                         </Text>
//                     </View>
                    
//                     <View style={styles.eventInfo}>
//                         <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.primary} />
//                         <Text style={styles.eventInfoText}>
//                             {event.venue || 'Đang cập nhật địa điểm'}
//                         </Text>
//                     </View>
//                 </View>
                
//                 <Divider style={{ marginVertical: 16 }} />
                
//                 <View style={styles.ticketSection}>
//                     <Text style={styles.sectionTitle}>Chọn loại vé</Text>
                    
//                     <RadioButton.Group onValueChange={setSelectedTicket} value={selectedTicket}>
//                         {tickets && tickets.map((ticket) => (
//                             <Surface 
//                                 key={ticket.id} 
//                                 style={[
//                                     styles.ticketOption, 
//                                     selectedTicket === ticket.id ? styles.selectedTicket : styles.unselectedTicket,
//                                     { elevation: selectedTicket === ticket.id ? 2 : 0 }
//                                 ]}
//                             >
//                                 <RadioButton value={ticket.id} color={COLORS.primary} />
//                                 <View style={styles.ticketInfo}>
//                                     <Text style={styles.ticketType}>{ticket.name}</Text>
//                                     <Text style={styles.ticketPrice}>{ticket.price.toLocaleString('vi-VN')} VNĐ</Text>
//                                     <Text style={styles.ticketDescription}>
//                                         {ticket.description || 'Vé tham dự sự kiện'} • Còn {ticket.quantity} vé
//                                     </Text>
//                                 </View>
//                             </Surface>
//                         ))}
//                     </RadioButton.Group>
//                 </View>
                
//                 <View style={styles.quantityContainer}>
//                     <IconButton 
//                         icon="minus" 
//                         size={24}
//                         color={COLORS.text}
//                         style={{ backgroundColor: COLORS.border }}
//                         onPress={() => {
//                             if (parseInt(quantity) > 1) {
//                                 setQuantity((parseInt(quantity) - 1).toString());
//                             }
//                         }}
//                         disabled={parseInt(quantity) <= 1}
//                     />
//                     <TextInput
//                         mode="outlined"
//                         value={quantity}
//                         onChangeText={(text) => {
//                             const value = text.replace(/[^0-9]/g, '');
//                             setQuantity(value || '1');
//                         }}
//                         keyboardType="numeric"
//                         style={styles.quantityInput}
//                         outlineColor={COLORS.border}
//                         activeOutlineColor={COLORS.primary}
//                         label="Số lượng"
//                     />
//                     <IconButton 
//                         icon="plus" 
//                         size={24}
//                         color="white"
//                         style={{ backgroundColor: COLORS.primary }}
//                         onPress={() => {
//                             const selectedTicketObj = tickets.find(t => t.id === selectedTicket);
//                             if (selectedTicketObj && parseInt(quantity) < selectedTicketObj.quantity) {
//                                 setQuantity((parseInt(quantity) + 1).toString());
//                             }
//                         }}
//                         disabled={!selectedTicket}
//                     />
//                 </View>
                
//                 <View style={styles.discountContainer}>
//                     <Text style={styles.sectionTitle}>Mã giảm giá</Text>
//                     <TextInput
//                         mode="outlined"
//                         value={discount}
//                         onChangeText={setDiscount}
//                         placeholder="Nhập mã giảm giá (nếu có)"
//                         style={styles.discountInput}
//                         outlineColor={COLORS.border}
//                         activeOutlineColor={COLORS.primary}
//                         right={
//                             <TextInput.Icon 
//                                 icon="ticket-percent" 
//                                 color={COLORS.primary}
//                             />
//                         }
//                     />
//                 </View>
                
//                 <View style={styles.paymentSection}>
//                     <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
                    
//                     <RadioButton.Group onValueChange={setPaymentMethod} value={paymentMethod}>
//                         <Surface 
//                             style={[
//                                 styles.paymentOption, 
//                                 paymentMethod === 'MoMo' ? styles.selectedTicket : styles.unselectedTicket,
//                                 { elevation: paymentMethod === 'MoMo' ? 2 : 0 }
//                             ]}
//                         >
//                             <RadioButton value="MoMo" color={COLORS.primary} />
//                             <View style={styles.paymentInfo}>
//                                 <Text style={styles.paymentName}>MoMo</Text>
//                                 <Text style={styles.paymentDescription}>Thanh toán qua ví điện tử MoMo</Text>
//                             </View>
//                         </Surface>
                        
//                         <Surface 
//                             style={[
//                                 styles.paymentOption, 
//                                 paymentMethod === 'VNPAY' ? styles.selectedTicket : styles.unselectedTicket,
//                                 { elevation: paymentMethod === 'VNPAY' ? 2 : 0 }
//                             ]}
//                         >
//                             <RadioButton value="VNPAY" color={COLORS.primary} />
//                             <View style={styles.paymentInfo}>
//                                 <Text style={styles.paymentName}>VNPAY</Text>
//                                 <Text style={styles.paymentDescription}>Thanh toán qua VNPAY</Text>
//                             </View>
//                         </Surface>
                        
//                         <Surface 
//                             style={[
//                                 styles.paymentOption, 
//                                 paymentMethod === 'FAKE' ? styles.selectedTicket : styles.unselectedTicket,
//                                 { elevation: paymentMethod === 'FAKE' ? 2 : 0 }
//                             ]}
//                         >
//                             <RadioButton value="FAKE" color={COLORS.primary} />
//                             <View style={styles.paymentInfo}>
//                                 <Text style={styles.paymentName}>Test (Fake Payment)</Text>
//                                 <Text style={styles.paymentDescription}>Chỉ dùng để test</Text>
//                             </View>
//                         </Surface>
//                     </RadioButton.Group>
//                 </View>
                
//                 <Button
//                     mode="contained"
//                     onPress={handleBookTicket}
//                     loading={booking}
//                     disabled={booking || !selectedTicket || !quantity || parseInt(quantity) <= 0 || !paymentMethod}
//                     style={styles.bookButton}
//                     labelStyle={{ color: 'white', fontWeight: 'bold' }}
//                 >
//                     Đặt vé ngay
//                 </Button>
                
//                 {momoQrUrl && (
//                     <View style={styles.orderConfirmContainer}>
//                         <MaterialCommunityIcons 
//                             name="check-circle" 
//                             size={60} 
//                             color={COLORS.primary}
//                             style={styles.successIcon}
//                         />
                        
//                         <Text style={styles.orderTitle}>Đã tạo đơn hàng thành công</Text>
//                         <Text style={styles.orderDetail}>
//                             Vui lòng quét mã QR để thanh toán qua MoMo
//                         </Text>
                        
//                         <Surface style={styles.qrContainer}>
//                             {momoQrUrl.startsWith('http') ? (
//                                 <Image
//                                     source={{ uri: momoQrUrl }}
//                                     style={styles.momoQrImage}
//                                     resizeMode="contain"
//                                 />
//                             ) : (
//                                 <QRCode 
//                                     value={momoQrUrl} 
//                                     size={200}
//                                     backgroundColor="white"
//                                     color={COLORS.text}
//                                 />
//                             )}
//                         </Surface>
                        
//                         <Text style={styles.orderDetail}>
//                             Sau khi thanh toán thành công, mã QR vé sẽ được gửi cho bạn.
//                         </Text>
//                     </View>
//                 )}
//             </Surface>
//         </ScrollView>
//     );
// };

// export default BookTicket;
