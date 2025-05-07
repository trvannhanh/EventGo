import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import api from '../../configs/Apis'; // dùng api đã cấu hình baseURL
import MyStyles from '../styles/MyStyles';
import { Card, Title, TextInput as PaperTextInput, Button as PaperButton, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        setLoading(true);
        try {
            // Tạo FormData object để gửi dữ liệu dưới dạng form data
            const formData = new FormData();
            formData.append('username', username);
            formData.append('email', email);
            formData.append('password', password);

            const response = await api.post('users/', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                }
            });
            Alert.alert('Thành công', 'Đăng ký thành công!');
        } catch (error) {     
            console.error('Lỗi đăng ký:', error.response ? error.response.data : error.message);
            Alert.alert('Lỗi', 'Đăng ký thất bại: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card style={MyStyles.cardPastel}>
            <Card.Content>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="account-plus" size={48} style={MyStyles.iconPastel} />
                </View>
                <Title style={MyStyles.titlePastel}>Đăng ký</Title>
                <PaperTextInput
                    mode="outlined"
                    label="Tên đăng nhập"
                    value={username}
                    onChangeText={setUsername}
                    style={MyStyles.inputPastel}
                    outlineColor="#A49393"
                    activeOutlineColor="#A49393"
                    textColor="#222"
                />
                <PaperTextInput
                    mode="outlined"
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={MyStyles.inputPastel}
                    outlineColor="#A49393"
                    activeOutlineColor="#A49393"
                    textColor="#222"
                />
                <PaperTextInput
                    mode="outlined"
                    label="Mật khẩu"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={MyStyles.inputPastel}
                    outlineColor="#A49393"
                    activeOutlineColor="#A49393"
                    textColor="#222"
                />
                <PaperButton mode="contained" onPress={handleRegister} loading={loading} disabled={loading} style={MyStyles.buttonPastel} labelStyle={MyStyles.buttonLabelLight}>
                    Đăng ký
                </PaperButton>
            </Card.Content>
        </Card>
    );
}