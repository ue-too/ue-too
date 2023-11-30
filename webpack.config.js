const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
{
    mode: "development",
    entry: './playground/index.ts',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
            test: /\.css$/i,
            use: ["style-loader", "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      filename: 'bundled.js',
      path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "./htmlTemplate/index.html",
            filename: 'index.html',
            inject: 'body',
            path: path.resolve(__dirname, 'dist'),// Output directory
            publicPath: "/"
        })
    ],
    devServer: {
        static: path.resolve(__dirname, 'dist'), // Specify the directory for serving static files
    },
}
];