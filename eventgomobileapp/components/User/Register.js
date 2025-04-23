import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import api from '../../configs/Apis'; // dùng api đã cấu hình baseURL
import MyStyles from '../styles/MyStyles';
import { Card, Title, TextInput as PaperTextInput, Button as PaperButton, Paragraph } from 'react-native-paper';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        setLoading(true);
        try {
            const response = await api.post('users/', {
                username,
                email,
                password,
            }, {
                headers: { 'Content-Type': 'application/json' }
            });
            Alert.alert('Thành công', 'Đăng ký thành công!');
        } catch (error) {     
            Alert.alert('Lỗi', 'Đăng ký thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card style={{ margin: 16, padding: 16 }}>
            <Card.Content>
                <Title style={{ textAlign: 'center', marginBottom: 12 }}>Đăng ký</Title>
                <PaperTextInput
                    mode="outlined"
                    label="Tên đăng nhập"
                    value={username}
                    onChangeText={setUsername}
                    style={{ marginBottom: 16 }}
                />
                <PaperTextInput
                    mode="outlined"
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={{ marginBottom: 16 }}
                />
                <PaperTextInput
                    mode="outlined"
                    label="Mật khẩu"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={{ marginBottom: 16 }}
                />
                <PaperButton mode="contained" onPress={handleRegister} loading={loading} disabled={loading}>
                    Đăng ký
                </PaperButton>
            </Card.Content>
        </Card>
    );
}