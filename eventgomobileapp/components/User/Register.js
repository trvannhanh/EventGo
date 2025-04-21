import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import api from '../../configs/Apis'; // dùng api đã cấu hình baseURL
import MyStyles from '../styles/MyStyles';

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
        <View style={MyStyles.containerCenter}>
            <Text style={MyStyles.title}>Đăng ký</Text>
            <TextInput
                style={MyStyles.input}
                placeholder="Tên đăng nhập"
                value={username}
                onChangeText={setUsername}
            />
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
            <Button title={loading ? 'Đang đăng ký...' : 'Đăng ký'} onPress={handleRegister} disabled={loading} />
        </View>
    );
}