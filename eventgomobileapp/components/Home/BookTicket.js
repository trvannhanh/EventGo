import React, { useEffect, useState } from 'react';
import { ScrollView, ActivityIndicator, View, Alert, Text, Image, Linking } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton, RadioButton, TextInput as PaperTextInput } from 'react-native-paper';
import api, { endpoints } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApis } from '../../configs/Apis';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MyStyles from '../styles/MyStyles';
import QRCode from 'react-native-qrcode-svg';

const BookTicket = ({ route, navigation }) => {
    const { eventId } = route.params;
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [quantity, setQuantity] = useState('1');
    const [discount, setDiscount] = useState('');
    const [booking, setBooking] = useState(false);
    const [orderId, setOrderId] = useState(null);
    const [qrImages, setQrImages] = useState([]);
    const [momoQrUrl, setMomoQrUrl] = useState(null);
    const [momoPayUrl, setMomoPayUrl] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('MoMo');

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                // console.log('eventId:', eventId);
                const res = await api.get(endpoints.eventDetail(eventId));
                // console.log('event detail:', res.data);
                setEvent(res.data);
                const ticketRes = await api.get(endpoints.ticketsOfEvent(eventId));
                // console.log('tickets:', ticketRes.data);
                setTickets(ticketRes.data);
            } catch (err) {
                // console.log('ERROR:', err, err.response?.data);
                setEvent(null);
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [eventId]);

    const handleBookTicket = async () => {
        if (!selectedTicket) {
            Alert.alert('Lỗi', 'Vui lòng chọn loại vé!');
            return;
        }
        setBooking(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await authApis(token).post(endpoints.bookTicket(eventId), {
                ticket_id: selectedTicket,
                quantity: parseInt(quantity),
                payment_method: paymentMethod,
                discount_code: discount || undefined,
            });
            if (res.data && res.data.qrCodeUrl) {
                // console.log('MoMo QR URL:', res.data.qrCodeUrl);
                setMomoQrUrl(res.data.qrCodeUrl);
                setMomoPayUrl(res.data.payUrl);
            }
            if (res.data && res.data.order_id) {
                setOrderId(res.data.order_id);
                // Lấy mã QR từ đơn hàng (nếu đã thanh toán thành công)
                const orderRes = await authApis(token).get(`orders/${res.data.order_id}/`);
                setQrImages(orderRes.data.qr_image_urls || []);
            }
            Alert.alert('Thành công', 'Vui lòng quét mã QR MoMo để thanh toán. Sau khi thanh toán thành công, mã QR vé sẽ được gửi cho bạn.');
        } catch (err) {
            Alert.alert('Đặt vé thất bại!');
        } finally {
            setBooking(false);
        }
    };

    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
    if (!event) return <Paragraph style={{ margin: 20, color: 'red' }}>Không tìm thấy sự kiện.</Paragraph>;

    return (
        <ScrollView>
            <Card style={MyStyles.cardPastel}>
                <Card.Content>
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                        <MaterialCommunityIcons name="ticket-plus" size={48} style={MyStyles.iconPastel} />
                    </View>
                    <Title style={MyStyles.titlePastel}>Đặt vé</Title>
                    <Paragraph style={MyStyles.labelPastel}>Sự kiện: <Text style={MyStyles.textDark}>{event.name}</Text></Paragraph>
                    <Paragraph style={MyStyles.labelPastel}>Ngày: <Text style={MyStyles.textDark}>{event.date}</Text></Paragraph>
                    <Paragraph style={MyStyles.labelPastel}>Địa điểm: <Text style={MyStyles.textDark}>{event.location}</Text></Paragraph>
                    <Paragraph style={MyStyles.labelPastel}>Mô tả: <Text style={MyStyles.textDark}>{event.description}</Text></Paragraph>
                    <Paragraph style={{ marginTop: 16, ...MyStyles.labelPastel }}>Chọn loại vé:</Paragraph>
                    <RadioButton.Group onValueChange={setSelectedTicket} value={selectedTicket}>
                        {tickets.map(ticket => (
                            <View key={ticket.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <RadioButton value={ticket.id} color="#A49393" />
                                <Paragraph style={MyStyles.textDark}>{ticket.type} - {ticket.price}đ (Còn {ticket.quantity})</Paragraph>
                            </View>
                        ))}
                    </RadioButton.Group>
                    <Paragraph style={{ marginTop: 8, ...MyStyles.labelPastel }}>Số lượng:</Paragraph>
                    <PaperTextInput
                        mode="outlined"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        style={[MyStyles.inputPastel, { width: 100, marginBottom: 8 }]}
                        outlineColor="#A49393"
                        activeOutlineColor="#A49393"
                        textColor="#222"
                    />
                    <Paragraph style={MyStyles.labelPastel}>Mã giảm giá (nếu có):</Paragraph>
                    <PaperTextInput
                        mode="outlined"
                        value={discount}
                        onChangeText={setDiscount}
                        placeholder="Nhập mã giảm giá"
                        style={MyStyles.inputPastel}
                        outlineColor="#A49393"
                        activeOutlineColor="#A49393"
                        textColor="#222"
                    />
                    <Paragraph style={{ marginTop: 16, ...MyStyles.labelPastel }}>Chọn phương thức thanh toán:</Paragraph>
                    <RadioButton.Group onValueChange={setPaymentMethod} value={paymentMethod} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <RadioButton value="MoMo" color="#A49393" />
                            <Paragraph style={MyStyles.textDark}>MoMo</Paragraph>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <RadioButton value="VNPAY" color="#A49393" />
                            <Paragraph style={MyStyles.textDark}>VNPAY</Paragraph>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <RadioButton value="FAKE" color="#A49393" />
                            <Paragraph style={MyStyles.textDark}>Thanh toán (test)</Paragraph>
                        </View>
                    </RadioButton.Group>
                </Card.Content>
                <Card.Actions>
                    <PaperButton mode="contained" onPress={handleBookTicket} loading={booking} disabled={booking} style={MyStyles.buttonPastel} labelStyle={MyStyles.buttonLabelLight}>
                        Đặt vé
                    </PaperButton>
                </Card.Actions>
                {momoQrUrl && (
                    <View style={{ alignItems: 'center', marginTop: 24 }}>
                        <Title style={MyStyles.titlePastel}>Thanh toán MoMo</Title>
                        
                        {momoQrUrl.startsWith('http') ? (
                            <Image
                                source={{ uri: momoQrUrl }}
                                style={{ width: 220, height: 220, marginBottom: 12, borderRadius: 12, backgroundColor: '#FFF6F6' }}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <QRCode value={momoQrUrl} size={220} backgroundColor="#FFF6F6" />
                                
                            </View>
                        )}
                        
                    
                    </View>
                )}
                
            </Card>
        </ScrollView>
    );
};

export default BookTicket;
