import { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>地図をタップしてピンを刺してください</Text>
        </View>
        <WebView
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
  header: { padding: 12, paddingTop: 50 },
  title: { fontWeight: 'bold' },
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
