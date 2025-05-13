import React, { useState, useContext } from 'react';
import { View, Alert, TouchableOpacity, Text, StyleSheet, TouchableWithoutFeedback, Keyboard, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Apis, { authApis, endpoints } from '../../configs/Apis';
import { MyDispatchContext } from '../../configs/MyContexts';
import { TextInput, Button, Paragraph, Switch, HelperText, Surface, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import MyStyles, { COLORS } from '../styles/MyStyles';

const Login = () => {
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
            marginBottom: 20,
        },
        subtitle: {
            fontSize: 16,
            color: COLORS.textSecondary,
            textAlign: 'center',
            marginBottom: 30,
        },
        input: {
            marginBottom: 15,
            backgroundColor: COLORS.background,
        },
        rememberRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginVertical: 10,
            alignItems: 'center',
        },
        forgotPassword: {
            color: COLORS.primary,
        },
        loginButton: {
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
        dividerContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 20,
        },
        divider: {
            flex: 1,
            height: 1,
            backgroundColor: COLORS.divider,
        },
        dividerText: {
            paddingHorizontal: 10,
            color: COLORS.textSecondary,
        },
        signUpText: {
            textAlign: 'center',
            marginTop: 20,
            color: COLORS.textSecondary,
        },
        signUpLink: {
            color: COLORS.primary,
            fontWeight: 'bold',
        },
        errorText: {
            color: COLORS.error,
            marginBottom: 10,
            textAlign: 'center',
        },
        logo: {
            alignSelf: 'center',
            width: 120,
            height: 120,
            marginBottom: 20,
        },
        card: {
            ...MyStyles.card,
            padding: 20,
            marginHorizontal: 0,
        }
    });    const info = [{
        label: 'Tên đăng nhập',
        field: 'username',
        icon: 'account',
        secureTextEntry: false,
        autoCapitalize: "none",
        name: "email"
    }, {
        label: 'Mật khẩu',
        field: 'password',
        icon: 'lock',
        autoCapitalize: "none",
        secureTextEntry: true,
        name: "lock"
    }];

    

    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [msg, setMsg] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const nav = useNavigation();
    const dispatch = useContext(MyDispatchContext);

    const setState = (value, field) => {
        setUser({...user, [field]: value})
    }


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

        setMsg('');
        return true;
    }

    const handleLogin = async () => {
        if (validate() === true) {
            try {
                setLoading(true);
    
                let res = await Apis.post(endpoints['login'], {
                    ...user, 
                    client_id: 'm1lijofuYnBkhCeuIHp2Pi44NNGHSDB9WBIEcpHb',
                    client_secret: 'Bs9D3mrYsQwxqmPv4kQ8HcV5QU0TfhdQqL7p7OYBJtPoUDxlhPbQh3K9a2HPk7y4RsjcE8pW9hPo8dMHraSQaTqQvUFPZFbnp2tgmSjWWsqOJn4aOjyJ5DRQGnHaIoWt',
                    grant_type: 'password'
                },{
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                await AsyncStorage.setItem('token', res.data.access_token);

                let u = await authApis(res.data.access_token).get(endpoints['current-user']);
                
                dispatch({
                    "type": "login",
                    "payload": u.data
                });

                if (res.status === 200)
                    nav.navigate('home');

            } catch (ex) {
                if (ex.response && ex.response.status === 400) {
                    setMsg("Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.");
                } else {
                    setMsg("Đã xảy ra lỗi. Vui lòng thử lại sau.");
                }
                console.error(ex);
            } finally {
                setLoading(false);
            }
        }
    };    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
                <Image 
                    source={require('../../assets/eventgo_logo.png')} 
                    style={styles.logo} 
                    resizeMode="contain"
                />
                <Surface style={styles.card} elevation={1}>
                    <Text style={styles.title}>Đăng nhập</Text>
                    <Text style={styles.subtitle}>Chào mừng trở lại với EventGo</Text>
                    
                    {msg ? (
                        <Text style={styles.errorText}>{msg}</Text>
                    ) : null}

                    {info.map(i => (
                        <TextInput
                            key={i.field}
                            mode="outlined"
                            label={i.label}
                            value={user[i.field]}
                            onChangeText={t => setState(t, i.field)}
                            autoCapitalize={i.autoCapitalize}
                            style={styles.input}
                            secureTextEntry={i.field === 'password' ? !passwordVisible : false}
                            outlineColor={COLORS.border}
                            activeOutlineColor={COLORS.primary}
                            textColor={COLORS.text}
                            left={<TextInput.Icon icon={i.icon} color={COLORS.primary} />}
                            right={i.field === 'password' ? 
                                <TextInput.Icon 
                                    icon={passwordVisible ? 'eye-off' : 'eye'} 
                                    color={COLORS.primary} 
                                    onPress={() => setPasswordVisible(!passwordVisible)}
                                /> : null
                            }
                        />
                    ))}

                    <View style={styles.rememberRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Switch 
                                value={rememberMe} 
                                onValueChange={setRememberMe} 
                                color={COLORS.primary} 
                            />
                            <Text style={{ color: COLORS.text, marginLeft: 5 }}>Nhớ mật khẩu</Text>
                        </View>
                        <TouchableOpacity>
                            <Text style={styles.forgotPassword}>Quên mật khẩu?</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <Button 
                        mode="contained" 
                        onPress={handleLogin} 
                        loading={loading} 
                        disabled={loading} 
                        style={styles.loginButton} 
                        contentStyle={{ paddingVertical: 6 }}
                        labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                    >
                        ĐĂNG NHẬP
                    </Button>

                    <View style={styles.dividerContainer}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>HOẶC</Text>
                        <View style={styles.divider} />
                    </View>

                    <TouchableOpacity style={styles.socialButton}>
                        <MaterialCommunityIcons name="google" size={24} color={COLORS.googleRed} />
                        <Text style={styles.socialText}>Đăng nhập với Google</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.socialButton}>
                        <MaterialCommunityIcons name="facebook" size={24} color={COLORS.facebookBlue} />
                        <Text style={styles.socialText}>Đăng nhập với Facebook</Text>
                    </TouchableOpacity>
                </Surface>

                <View style={{ marginTop: 20 }}>
                    <Text style={styles.signUpText}>
                        Chưa có tài khoản? <Text 
                            style={styles.signUpLink}
                            onPress={() => nav.navigate('register')}
                        >
                            Đăng ký
                        </Text>
                    </Text>
                </View>
            </View>
        </TouchableWithoutFeedback>
    );

}


export default Login;
