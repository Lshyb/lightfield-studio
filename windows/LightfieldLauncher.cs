using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("LIGHTFIELD Offline Studio")]
[assembly: AssemblyDescription("Local offline launcher for LIGHTFIELD portrait lighting studio")]
[assembly: AssemblyCompany("LIGHTFIELD contributors")]
[assembly: AssemblyProduct("LIGHTFIELD")]
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: AssemblyFileVersion("1.1.0.0")]

namespace Lightfield
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            bool headless = Array.IndexOf(args, "--headless") >= 0;
            bool explicitPort = false;
            int port = 4173;
            try
            {
                for (int i = 0; i < args.Length; i++)
                {
                    if (args[i] == "--headless") continue;
                    if (args[i] == "--port" && i + 1 < args.Length)
                    {
                        explicitPort = true;
                        if (!Int32.TryParse(args[++i], NumberStyles.None, CultureInfo.InvariantCulture, out port)
                            || port < 1024 || port > 65535)
                            throw new ArgumentException("Choose a port from 1024 to 65535.");
                        continue;
                    }
                    throw new ArgumentException("Usage: Lightfield.exe [--headless] [--port 4186]");
                }

                string root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                using (StudioServer server = new StudioServer(Path.Combine(root, "dist")))
                {
                    server.Start(port, explicitPort ? 1 : 10);
                    Console.WriteLine("LIGHTFIELD 1.1.0: " + server.Address);
                    if (headless)
                    {
                        using (ManualResetEvent stopped = new ManualResetEvent(false))
                        {
                            ConsoleCancelEventHandler cancel = delegate(object sender, ConsoleCancelEventArgs e)
                            {
                                e.Cancel = true;
                                stopped.Set();
                            };
                            Console.CancelKeyPress += cancel;
                            try { stopped.WaitOne(); }
                            finally { Console.CancelKeyPress -= cancel; }
                        }
                    }
                    else
                    {
                        Application.EnableVisualStyles();
                        Application.SetCompatibleTextRenderingDefault(false);
                        Application.Run(new StudioWindow(server));
                    }
                }
                return 0;
            }
            catch (Exception error)
            {
                string message = error.Message;
                Console.Error.WriteLine(message);
                if (!headless)
                    MessageBox.Show("无法启动光场摄影棚。\n\n" + message, "LIGHTFIELD", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }
    }

    internal sealed class StudioWindow : Form
    {
        private readonly StudioServer server;
        private readonly Label browserStatus;

        public StudioWindow(StudioServer server)
        {
            this.server = server;
            Text = "光场 LIGHTFIELD · 离线摄影棚";
            BackColor = Color.FromArgb(19, 23, 25);
            ForeColor = Color.FromArgb(232, 233, 227);
            Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(514, 266);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;

            Label title = new Label();
            title.Text = "光场  LIGHTFIELD";
            title.Font = new Font("Microsoft YaHei UI", 18F, FontStyle.Bold, GraphicsUnit.Point);
            title.ForeColor = Color.FromArgb(233, 187, 123);
            title.SetBounds(27, 25, 460, 37);
            Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = "离线人像布光工作室  /  3D PORTRAIT STUDIO";
            subtitle.Font = new Font("Microsoft YaHei UI", 8.5F, FontStyle.Regular, GraphicsUnit.Point);
            subtitle.ForeColor = Color.FromArgb(154, 167, 154);
            subtitle.SetBounds(29, 69, 460, 23);
            Controls.Add(subtitle);

            TextBox address = new TextBox();
            address.Text = server.Address;
            address.ReadOnly = true;
            address.BorderStyle = BorderStyle.FixedSingle;
            address.BackColor = Color.FromArgb(29, 35, 32);
            address.ForeColor = Color.FromArgb(223, 227, 216);
            address.Font = new Font("Consolas", 11F, FontStyle.Regular, GraphicsUnit.Point);
            address.SetBounds(30, 112, 451, 30);
            Controls.Add(address);

            Button open = new Button();
            open.Text = "打开摄影棚  ↗";
            open.FlatStyle = FlatStyle.Flat;
            open.FlatAppearance.BorderColor = Color.FromArgb(233, 187, 123);
            open.FlatAppearance.BorderSize = 0;
            open.BackColor = Color.FromArgb(233, 187, 123);
            open.ForeColor = Color.FromArgb(35, 34, 29);
            open.Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold, GraphicsUnit.Point);
            open.SetBounds(30, 161, 188, 39);
            open.Click += delegate { OpenBrowser(); };
            Controls.Add(open);
            AcceptButton = open;

            browserStatus = new Label();
            browserStatus.Text = "● 仅在这台电脑提供服务";
            browserStatus.ForeColor = Color.FromArgb(159, 183, 161);
            browserStatus.Font = new Font("Microsoft YaHei UI", 8F, FontStyle.Regular, GraphicsUnit.Point);
            browserStatus.SetBounds(235, 172, 250, 23);
            Controls.Add(browserStatus);

            Label hint = new Label();
            hint.Text = "保持此窗口开启。关闭窗口后，摄影棚服务也会停止。";
            hint.ForeColor = Color.FromArgb(126, 140, 127);
            hint.Font = new Font("Microsoft YaHei UI", 8F, FontStyle.Regular, GraphicsUnit.Point);
            hint.SetBounds(30, 222, 454, 24);
            Controls.Add(hint);

            Shown += delegate { BeginInvoke(new Action(OpenBrowser)); };
            FormClosed += delegate { server.Stop(); };
        }

        private void OpenBrowser()
        {
            try
            {
                Process.Start(new ProcessStartInfo(server.Address) { UseShellExecute = true });
                browserStatus.Text = "● 摄影棚已就绪";
            }
            catch
            {
                browserStatus.Text = "请复制上方地址到浏览器";
            }
        }
    }

    internal sealed class RequestFailure : Exception
    {
        public readonly int Status;
        public RequestFailure(int status) { Status = status; }
    }

    internal sealed class StudioServer : IDisposable
    {
        private const int MaxHeaderBytes = 16384;
        private const int MaxRequestLineBytes = 4096;
        private readonly string root;
        private readonly string rootPrefix;
        private readonly object clientsLock = new object();
        private readonly List<TcpClient> clients = new List<TcpClient>();
        private TcpListener listener;
        private Thread acceptThread;
        private volatile bool stopping;
        public string Address { get; private set; }

        public StudioServer(string directory)
        {
            root = Path.GetFullPath(directory);
            rootPrefix = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!Directory.Exists(root) || !File.Exists(Path.Combine(root, "index.html")))
                throw new DirectoryNotFoundException("Keep Lightfield.exe beside the complete dist folder.");
            if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("The dist folder must be a regular directory, not a link.");
        }

        public void Start(int firstPort, int attempts)
        {
            if (listener != null) throw new InvalidOperationException("The studio is already running.");
            SocketException last = null;
            for (int offset = 0; offset < attempts && firstPort + offset <= 65535; offset++)
            {
                int port = firstPort + offset;
                TcpListener candidate = new TcpListener(IPAddress.Loopback, port);
                try
                {
                    candidate.Start(64);
                    listener = candidate;
                    Address = "http://127.0.0.1:" + port.ToString(CultureInfo.InvariantCulture) + "/";
                    stopping = false;
                    acceptThread = new Thread(AcceptLoop);
                    acceptThread.IsBackground = true;
                    acceptThread.Name = "LIGHTFIELD HTTP listener";
                    acceptThread.Start();
                    return;
                }
                catch (SocketException error)
                {
                    candidate.Stop();
                    if (error.SocketErrorCode != SocketError.AddressAlreadyInUse && error.SocketErrorCode != SocketError.AccessDenied)
                        throw;
                    last = error;
                }
            }
            throw new IOException("The requested local port is unavailable. Close the other program or use --port 4200.", last);
        }

        private void AcceptLoop()
        {
            while (!stopping)
            {
                TcpClient client;
                try { client = listener.AcceptTcpClient(); }
                catch (SocketException) { if (stopping) return; continue; }
                catch (ObjectDisposedException) { return; }
                client.NoDelay = true;
                client.ReceiveTimeout = 5000;
                client.SendTimeout = 10000;
                lock (clientsLock)
                {
                    if (stopping) { client.Close(); return; }
                    clients.Add(client);
                }
                ThreadPool.QueueUserWorkItem(ServeClient, client);
            }
        }

        private void ServeClient(object state)
        {
            TcpClient client = (TcpClient)state;
            bool head = false;
            try
            {
                using (NetworkStream stream = new NetworkStream(client.Client, false))
                {
                    stream.ReadTimeout = 5000;
                    stream.WriteTimeout = 10000;
                    try
                    {
                        string request = ReadHeader(stream);
                        string[] lines = request.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                        string[] first = lines[0].Split(new char[] { ' ' }, StringSplitOptions.None);
                        if (first.Length != 3 || first[0].Length == 0 || first[1].Length == 0)
                            throw new RequestFailure(400);
                        head = first[0] == "HEAD";
                        if (first[2] != "HTTP/1.1" && first[2] != "HTTP/1.0") throw new RequestFailure(505);
                        ValidateHeaders(lines, first[2] == "HTTP/1.1");
                        if (first[0] != "GET" && !head)
                        {
                            WriteText(stream, 405, "Method not allowed", head, "Allow: GET, HEAD\r\n");
                            return;
                        }
                        string path = DecodePath(first[1]);
                        if (path == "/health.json")
                        {
                            byte[] health = Encoding.UTF8.GetBytes("{\"app\":\"lightfield-studio\",\"version\":\"1.1.0\",\"offline\":true}");
                            WriteHeaders(stream, 200, "application/json; charset=utf-8", health.Length, null);
                            if (!head) stream.Write(health, 0, health.Length);
                            return;
                        }
                        string target = ResolvePath(path);
                        using (FileStream file = new FileStream(target, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, FileOptions.SequentialScan))
                        {
                            WriteHeaders(stream, 200, MimeType(target), file.Length, null);
                            if (!head) file.CopyTo(stream, 65536);
                        }
                    }
                    catch (RequestFailure error) { TryWriteText(stream, error.Status, head); }
                    catch (FileNotFoundException) { TryWriteText(stream, 404, head); }
                    catch (DirectoryNotFoundException) { TryWriteText(stream, 404, head); }
                    catch (PathTooLongException) { TryWriteText(stream, 414, head); }
                    catch (UnauthorizedAccessException) { TryWriteText(stream, 403, head); }
                    catch (ArgumentException) { TryWriteText(stream, 400, head); }
                    catch (NotSupportedException) { TryWriteText(stream, 400, head); }
                    catch (IOException error)
                    {
                        SocketException socket = error.InnerException as SocketException;
                        if (socket != null && socket.SocketErrorCode == SocketError.TimedOut) TryWriteText(stream, 408, head);
                    }
                }
            }
            catch (ObjectDisposedException) { }
            catch (IOException) { }
            catch (SocketException) { }
            catch (InvalidOperationException) { }
            catch (ArgumentException) { }
            finally
            {
                CloseClient(client);
                lock (clientsLock) { clients.Remove(client); }
            }
        }

        private static void CloseClient(TcpClient client)
        {
            try
            {
                Socket socket = client.Client;
                if (socket != null)
                {
                    socket.Shutdown(SocketShutdown.Send);
                    // Drain only already-queued input, with a strict bound. This lets
                    // clients read an oversized-request rejection before the close.
                    byte[] discard = new byte[4096];
                    int drained = 0;
                    while (drained < 65536 && socket.Available > 0)
                    {
                        int received = socket.Receive(discard, 0, Math.Min(discard.Length, 65536 - drained), SocketFlags.None);
                        if (received == 0) break;
                        drained += received;
                    }
                }
            }
            catch (SocketException) { }
            catch (ObjectDisposedException) { }
            finally { client.Close(); }
        }

        private static string ReadHeader(NetworkStream stream)
        {
            byte[] bytes = new byte[MaxHeaderBytes];
            int count = 0;
            bool firstLineFound = false;
            while (count < bytes.Length)
            {
                int previous = count;
                int read = stream.Read(bytes, count, Math.Min(2048, bytes.Length - count));
                if (read == 0) throw new RequestFailure(400);
                count += read;
                for (int i = Math.Max(0, previous - 3); i < count; i++)
                {
                    if (bytes[i] == 10 && (i == 0 || bytes[i - 1] != 13)) throw new RequestFailure(400);
                    if (!firstLineFound && i > 0 && bytes[i - 1] == 13 && bytes[i] == 10)
                    {
                        if (i > MaxRequestLineBytes) throw new RequestFailure(414);
                        firstLineFound = true;
                    }
                    if (i >= 3 && bytes[i - 3] == 13 && bytes[i - 2] == 10 && bytes[i - 1] == 13 && bytes[i] == 10)
                    {
                        for (int j = 0; j <= i; j++)
                        {
                            byte b = bytes[j];
                            if (b > 126 || (b < 32 && b != 9 && b != 10 && b != 13)) throw new RequestFailure(400);
                            if (b == 13 && (j == i || bytes[j + 1] != 10)) throw new RequestFailure(400);
                        }
                        return Encoding.ASCII.GetString(bytes, 0, i - 1);
                    }
                }
                if (!firstLineFound && count > MaxRequestLineBytes) throw new RequestFailure(414);
            }
            throw new RequestFailure(431);
        }

        private static void ValidateHeaders(string[] lines, bool hostRequired)
        {
            int hosts = 0;
            for (int i = 1; i < lines.Length; i++)
            {
                if (lines[i].Length == 0) continue;
                int colon = lines[i].IndexOf(':');
                if (colon <= 0) throw new RequestFailure(400);
                for (int j = 0; j < colon; j++)
                {
                    char c = lines[i][j];
                    if (!(c >= 'a' && c <= 'z') && !(c >= 'A' && c <= 'Z') && !(c >= '0' && c <= '9')
                        && "!#$%&'*+-.^_`|~".IndexOf(c) < 0) throw new RequestFailure(400);
                }
                if (String.Equals(lines[i].Substring(0, colon), "Host", StringComparison.OrdinalIgnoreCase))
                {
                    hosts++;
                    if (lines[i].Substring(colon + 1).Trim().Length == 0) throw new RequestFailure(400);
                }
            }
            if (hosts > 1 || (hostRequired && hosts != 1)) throw new RequestFailure(400);
        }

        private static int Hex(char c)
        {
            if (c >= '0' && c <= '9') return c - '0';
            if (c >= 'a' && c <= 'f') return c - 'a' + 10;
            if (c >= 'A' && c <= 'F') return c - 'A' + 10;
            return -1;
        }

        private static string DecodePath(string target)
        {
            if (target.Length == 0 || target[0] != '/' || target.StartsWith("//", StringComparison.Ordinal)
                || target.IndexOf('#') >= 0) throw new RequestFailure(400);
            for (int i = 0; i < target.Length; i++)
            {
                if (target[i] == '%')
                {
                    if (i + 2 >= target.Length || Hex(target[i + 1]) < 0 || Hex(target[i + 2]) < 0) throw new RequestFailure(400);
                    i += 2;
                }
            }
            int query = target.IndexOf('?');
            string raw = query < 0 ? target : target.Substring(0, query);
            List<byte> bytes = new List<byte>(raw.Length);
            for (int i = 0; i < raw.Length; i++)
            {
                if (raw[i] == '%')
                {
                    bytes.Add((byte)(Hex(raw[i + 1]) * 16 + Hex(raw[i + 2])));
                    i += 2;
                }
                else
                {
                    if (raw[i] > 127) throw new RequestFailure(400);
                    bytes.Add((byte)raw[i]);
                }
            }
            string path;
            try { path = new UTF8Encoding(false, true).GetString(bytes.ToArray()); }
            catch (DecoderFallbackException) { throw new RequestFailure(400); }
            foreach (char c in path)
                if (c < 32 || c == 127 || ":*?\"<>|".IndexOf(c) >= 0) throw new RequestFailure(400);
            return path.Replace('\\', '/');
        }

        private string ResolvePath(string path)
        {
            string relative = path == "/" ? "index.html" : path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            string target = Path.GetFullPath(Path.Combine(root, relative));
            if (!target.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase)) throw new RequestFailure(403);
            string current = root;
            foreach (string part in target.Substring(rootPrefix.Length).Split(Path.DirectorySeparatorChar))
            {
                current = Path.Combine(current, part);
                FileAttributes attributes = File.GetAttributes(current);
                if ((attributes & FileAttributes.ReparsePoint) != 0) throw new RequestFailure(403);
            }
            if (Directory.Exists(target)) throw new RequestFailure(404);
            return target;
        }

        private static string MimeType(string target)
        {
            switch (Path.GetExtension(target).ToLowerInvariant())
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": case ".mjs": return "text/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".glb": return "model/gltf-binary";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".png": return "image/png";
                case ".svg": return "image/svg+xml";
                case ".txt": return "text/plain; charset=utf-8";
                case ".ico": return "image/x-icon";
                default: return "application/octet-stream";
            }
        }

        private static string Reason(int status)
        {
            switch (status)
            {
                case 200: return "OK";
                case 400: return "Bad Request";
                case 403: return "Forbidden";
                case 404: return "Not Found";
                case 405: return "Method Not Allowed";
                case 408: return "Request Timeout";
                case 414: return "URI Too Long";
                case 431: return "Request Header Fields Too Large";
                case 505: return "HTTP Version Not Supported";
                default: return "Internal Server Error";
            }
        }

        private static void WriteHeaders(NetworkStream stream, int status, string type, long length, string extra)
        {
            string headers = "HTTP/1.1 " + status.ToString(CultureInfo.InvariantCulture) + " " + Reason(status) + "\r\n"
                + "Content-Type: " + type + "\r\nContent-Length: " + length.ToString(CultureInfo.InvariantCulture)
                + "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n"
                + (extra ?? String.Empty) + "\r\n";
            byte[] data = Encoding.ASCII.GetBytes(headers);
            stream.Write(data, 0, data.Length);
        }

        private static void WriteText(NetworkStream stream, int status, string text, bool head, string extra)
        {
            byte[] data = Encoding.UTF8.GetBytes(text);
            WriteHeaders(stream, status, "text/plain; charset=utf-8", data.Length, extra);
            if (!head) stream.Write(data, 0, data.Length);
        }

        private static void TryWriteText(NetworkStream stream, int status, bool head)
        {
            try { WriteText(stream, status, Reason(status), head, null); }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
        }

        public void Stop()
        {
            if (stopping) return;
            stopping = true;
            TcpListener current = listener;
            if (current != null) current.Stop();
            lock (clientsLock)
            {
                foreach (TcpClient client in clients) client.Close();
            }
            if (acceptThread != null && acceptThread != Thread.CurrentThread) acceptThread.Join(1000);
        }

        public void Dispose() { Stop(); }
    }
}
