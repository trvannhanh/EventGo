import React, { useState } from 'react';
import { View, Alert, StyleSheet, Text, TouchableOpacity, Image, TouchableWithoutFeedback, Keyboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MyStyles, { COLORS } from '../styles/MyStyles';
import { TextInput, Button, HelperText, Switch, Surface, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Apis, { endpoints } from '../../configs/Apis';

const Register = () => {
    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: COLORS.background,
            padding: 20,
            justifyContent: 'center',
        },
        title: {
            fontSize: 28,
            fontWeight: 'bold',
            color: COLORS.primary,
            textAlign: 'center',
            marginBottom: 10,
        },
        subtitle: {
            fontSize: 16,
            color: COLORS.textSecondary,
            textAlign: 'center',
            marginBottom: 20,
        },
        input: {
            marginBottom: 15,
            backgroundColor: COLORS.background,
        },
        button: {
            marginVertical: 15,
            borderRadius: 10,
            paddingVertical: 8,
            backgroundColor: COLORS.primary,
        },
        socialButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: 8,
            borderRadius: 10,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: COLORS.divider,
            backgroundColor: COLORS.background,
        },
        socialText: {
            marginLeft: 10,
            fontWeight: '500',
            color: COLORS.text,
        },
        signInText: {
            textAlign: 'center',
            marginTop: 20,
            color: COLORS.textSecondary,
        },
        signInLink: {
            color: COLORS.primary,
            fontWeight: 'bold',
        },
        avatar: { 
            width: 100,
            height: 100,
            borderRadius: 50,
            margin: 10,
            alignSelf: 'center',
            borderWidth: 2,
            borderColor: COLORS.primary,
            backgroundColor: COLORS.primaryLight,
        },
        photoPlaceholder: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        switchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 10,
        },
        switchLabel: {
            marginRight: 10,
            color: COLORS.text,
            fontSize: 16,
        },
        errorText: {
            color: COLORS.error,
            marginBottom: 10,
            textAlign: 'center',
        },
        card: {
            ...MyStyles.card,
            padding: 20,
            marginHorizontal: 0,
        },        photoButton: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: COLORS.primary,
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
    
    const info = [{
            label: 'Họ và tên lót',
            field: 'last_name',
            icon: 'account-details',
            secureTextEntry: false
        }, {
            label: 'Tên',
            field: 'first_name',
            icon: 'account',
            secureTextEntry: false
        }, {
            label: 'Tên đăng nhập',
            field: 'username',
            icon: 'at',
            secureTextEntry: false
        }, {
            label: 'Mật khẩu',
            field: 'password',
            icon: 'lock',
            secureTextEntry: true
        },  {
            label: 'Xác nhận mật khẩu',
            field: 'confirm',
            icon: 'lock-check',
            secureTextEntry: true
        }];
        
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const nav = useNavigation();
    const [isEnabled, setIsEnabled] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState({
        password: false,
        confirm: false
    });

    const setState = (value, field) => {
        setUser({...user, [field]: value})
    }

    const picker = async () => {
        let { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert("Permissions denied!");
        } else {
            const result = await ImagePicker.launchImageLibraryAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            
            if (!result.canceled)
                setState(result.assets[0], 'avatar');
        }
    }
    
    const togglePasswordVisibility = (field) => {
        setPasswordVisible({
            ...passwordVisible,
            [field]: !passwordVisible[field]
        });
    };

    const toggleSwitch = () => {
        setIsEnabled(previousState => !previousState);
    };

    const validate = () => {
        if (Object.values(user).length == 0) {
            setMsg("Vui lòng nhập thông tin!");
            return false;
        }

        for (let i of info)
            if (user[i.field] === '') {
                setMsg(`Vui lòng nhập ${i.label}!`);
                return false;
            }

        if (user.password && user.password !== user.confirm) {
            setMsg("Mật khẩu không khớp!");
            return false;
        }

        setMsg('');
        return true;
    }

    const register = async () => {
        if (validate() === true) {
            try {
                setLoading(true);
                
                let form = new FormData();
                for (let key in user)
                    if (key !== 'confirm') {
                        if (key === 'avatar') {
                            console.info(Math.random());
                            if (user.avatar?.uri) {
                                form.append('avatar', {
                                    uri: user.avatar.uri,
                                    name: user.avatar.fileName || `image-${Date.now()}.jpg`,
                                    type: user.avatar.type || 'image/jpeg',
                                });
                            }
                        } else
                            form.append(key, user[key]);
                    }

                form.append('role', isEnabled ? 'organizer' : 'attendee');

                let res = await Apis.post(endpoints['register'], form, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                if (res.status === 201)
                    nav.navigate('login');

            } catch (ex) {
                console.error(ex);
            } finally {
                setLoading(false);
            }        }
    }
    
    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <Surface style={styles.card} elevation={1}>
                    <Text style={styles.title}>Đăng ký tài khoản</Text>
                    <Text style={styles.subtitle}>Tham gia cùng EventGo ngay hôm nay</Text>
                    
                    {msg ? (
                        <Text style={styles.errorText}>{msg}</Text>
                    ) : null}

                    <View style={{ alignItems: 'center', marginVertical: 15 }}>
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity onPress={picker}>
                                {user?.avatar?.uri ? (
                                    <Image source={{ uri: user.avatar.uri }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, styles.photoPlaceholder]}>
                                        <MaterialCommunityIcons name="account" size={50} color={COLORS.primary} />
                                    </View>
                                )}
                                <View style={styles.photoButton}>
                                    <MaterialCommunityIcons name="camera" size={20} color="white" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {info.map(i => (
                        <TextInput
                            key={i.field}
                            secureTextEntry={i.secureTextEntry && !passwordVisible[i.field]}
                            mode="outlined"
                            label={i.label}
                            value={user[i.field]}
                            onChangeText={t => setState(t, i.field)}
                            style={styles.input}
                            outlineColor={COLORS.border}
                            activeOutlineColor={COLORS.primary}
                            textColor={COLORS.text}
                            left={<TextInput.Icon icon={i.icon} color={COLORS.primary} />}
                            right={i.secureTextEntry ? 
                                <TextInput.Icon 
                                    icon={passwordVisible[i.field] ? 'eye-off' : 'eye'} 
                                    color={COLORS.primary} 
                                    onPress={() => togglePasswordVisibility(i.field)}
                                /> : null
                            }
                        />
                    ))}

                    <View style={styles.switchContainer}>
                        <Text style={styles.switchLabel}>
                            Bạn là: {isEnabled ? 'Nhà tổ chức sự kiện' : 'Người tham dự sự kiện'}
                        </Text>
                        <Switch
                            value={isEnabled}
                            onValueChange={toggleSwitch}
                            color={COLORS.primary}
                        />
                    </View>
                    
                    <Button 
                        mode="contained" 
                        onPress={register} 
                        loading={loading} 
                        disabled={loading} 
                        style={styles.button}
                        contentStyle={{ paddingVertical: 6 }}
                        labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                    >
                        ĐĂNG KÝ
                    </Button>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: COLORS.divider }} />
                        <Text style={{ paddingHorizontal: 10, color: COLORS.textSecondary }}>HOẶC</Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: COLORS.divider }} />
                    </View>

                    <TouchableOpacity style={styles.socialButton}>
                        <MaterialCommunityIcons name="google" size={24} color={COLORS.googleRed} />
                        <Text style={styles.socialText}>Đăng ký với Google</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.socialButton}>
                        <MaterialCommunityIcons name="facebook" size={24} color={COLORS.facebookBlue} />
                        <Text style={styles.socialText}>Đăng ký với Facebook</Text>
                    </TouchableOpacity>
                </Surface>

                <View style={{ marginTop: 20 }}>
                    <Text style={styles.signInText}>
                        Đã có tài khoản? <Text 
                            style={styles.signInLink}
                            onPress={() => nav.navigate('login')}
                        >
                            Đăng nhập
                        </Text>
                    </Text>
                </View>
            </View>
        </TouchableWithoutFeedback>
    );
}

export default Register;