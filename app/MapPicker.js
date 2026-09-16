import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

// OpenStreetMap + Leaflet を WebView 内に埋め込み、タップ/ドラッグした位置を
// window.ReactNativeWebView.postMessage 経由で受け取る。地図タイル・Leaflet本体は
// CDN から読み込むため、実機のインターネット接続が必要（APIキーは不要）。
function buildHtml(initialLat, initialLng) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${initialLat}, ${initialLng}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var marker = L.marker([${initialLat}, ${initialLng}], { draggable: true }).addTo(map);

    function sendPosition() {
      var pos = marker.getLatLng();
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
    }

    // React Native側（検索結果選択時・現在地ボタン押下時）から地図を動かすための関数
    window.moveMarkerTo = function (lat, lng) {
      var latlng = [lat, lng];
      map.setView(latlng, 16);
      marker.setLatLng(latlng);
      sendPosition();
    };

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      sendPosition();
    });
    marker.on('dragend', sendPosition);
    sendPosition();
  </script>
</body>
</html>
`;
}

export default function MapPicker({ visible, initialLat, initialLng, onConfirm, onCancel }) {
  const [picked, setPicked] = useState({ lat: initialLat, lng: initialLng });
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const webviewRef = useRef(null);

  const html = useMemo(
    () => buildHtml(initialLat, initialLng),
    // 初期座標が変わったとき（現在地取得直後など）だけ地図を作り直す
    [initialLat, initialLng]
  );

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setPicked(data);
      }
    } catch (e) {
      console.log('map message parse error', e);
    }
  };

  const moveTo = (lat, lng) => {
    setPicked({ lat, lng });
    webviewRef.current?.injectJavaScript(
      `window.moveMarkerTo && window.moveMarkerTo(${lat}, ${lng}); true;`
    );
  };

  // 地図を手でスクロールして探すのが大変なので、住所・施設名で検索してジャンプできるようにする
  // （OpenStreetMapのNominatim。無料・APIキー不要）
  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          query.trim()
        )}`,
        { headers: { 'Accept-Language': 'ja' } }
      );
      const results = await res.json();
      if (results && results.length > 0) {
        moveTo(parseFloat(results[0].lat), parseFloat(results[0].lon));
      } else {
        Alert.alert('見つかりませんでした', '別のキーワードで試してください。');
      }
    } catch (e) {
      Alert.alert('検索に失敗しました', String(e));
    } finally {
      setSearching(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const position = await Location.getCurrentPositionAsync({});
      moveTo(position.coords.latitude, position.coords.longitude);
    } catch (e) {
      Alert.alert('現在地の取得に失敗しました', String(e));
    } finally {
      setLocating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>地図をタップしてピンを刺してください</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="住所や施設名で検索（例: 渋谷駅）"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={searching}>
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>検索</Text>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={handleUseCurrentLocation}
            disabled={locating}
          >
            <Text style={styles.currentLocationText}>
              {locating ? '取得中...' : '📍 現在地に移動'}
            </Text>
          </TouchableOpacity>
        </View>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html }}
          onMessage={handleMessage}
          style={styles.webview}
        />
        <View style={styles.footer}>
          <Text style={styles.coord}>
            選択中: {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          </Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => onConfirm(picked.lat, picked.lng)}
            >
              <Text style={styles.confirmText}>この場所に決定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 12, paddingTop: 50, gap: 8 },
  title: { fontWeight: 'bold' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  searchButtonText: { color: '#fff', fontWeight: 'bold' },
  currentLocationButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2f6fed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentLocationText: { color: '#2f6fed', fontWeight: 'bold', fontSize: 13 },
  webview: { flex: 1 },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  coord: { marginBottom: 8, color: '#333' },
  buttons: { flexDirection: 'row', gap: 8 },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  cancelText: { color: '#333' },
  confirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2f6fed',
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: 'bold' },
});
