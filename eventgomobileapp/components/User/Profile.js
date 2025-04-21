import React, { useContext } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import MyStyles from '../styles/MyStyles';
import { MyUserContext, MyDispatchContext } from '../../configs/MyContexts';

export default function Profile() {
    const user = useContext(MyUserContext);
    const dispatch = useContext(MyDispatchContext);

    const handleLogout = () => {
        dispatch({ type: 'logout' });
        Alert.alert('Đăng xuất', 'Bạn đã đăng xuất thành công!');
    };

    if (!user) {
        return (
            <View style={MyStyles.containerCenter}>
                <Text style={MyStyles.title}>Bạn chưa đăng nhập</Text>
            </View>
        );
    }

    // Log user object để debug
    console.log('USER PROFILE:', user);

    return (
        <View style={MyStyles.containerCenter}>
            <Text style={MyStyles.title}>Thông tin tài khoản</Text>
            <Text style={MyStyles.infoText}>Tên đăng nhập: {user.username}</Text>
            <Text style={MyStyles.infoText}>Email: {user.email}</Text>
            {user.role && <Text style={MyStyles.infoText}>Vai trò: {user.role}</Text>}
            <Button title="Đăng xuất" onPress={handleLogout} />
        </View>
    );
}
