import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import axios from 'axios';
import MyStyles from '../styles/MyStyles';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/api/login/', {
                email,
                password,
            });
            // Xử lý đăng nhập thành công (ví dụ: lưu token, chuyển màn hình)
            Alert.alert('Thành công', 'Đăng nhập thành công!');
        } catch (error) {
            Alert.alert('Lỗi', 'Đăng nhập thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={MyStyles.containerCenter}>
            <Text style={MyStyles.title}>Đăng nhập</Text>
            <TextInput
                style={MyStyles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput
                style={MyStyles.input}
                placeholder="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button title={loading ? 'Đang đăng nhập...' : 'Đăng nhập'} onPress={handleLogin} disabled={loading} />
        </View>
    );
}