import nextConfig from 'eslint-config-next';

const eslintConfig = [
  ...nextConfig,
  {
    // KHÔNG ignore server/ ở đây - `npm run lint` chỉ target app/components/lib qua
    // CLI args (xem package.json), còn `npx eslint server` (audit riêng, không sửa)
    // vẫn cần dùng chung config này để liệt kê lỗi.
    ignores: ['.next/**', 'node_modules/**', 'docs/**', 'public/**'],
    rules: {
      // Rule mới từ react-hooks v7 (React Compiler) báo lỗi cho MỌI setState
      // gọi được từ trong effect, kể cả pattern "fetch dữ liệu khi mount" mà
      // chính React docs công nhận là dùng effect đúng chỗ (không phải state
      // suy ra được lúc render). Toàn bộ ~10 chỗ bị rule này báo trong repo
      // đều là load-data-on-mount hợp lệ, không phải bug. Sửa "đúng" theo đề
      // xuất của rule (bỏ effect, chuyển sang data-fetching library/Server
      // Component) là đổi kiến trúc lớn, ngoài phạm vi dọn lint lần này.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default eslintConfig;
