import asyncio
import socketio


class DineFlowSocketClient:

    def __init__(
        self,
        backend_url,
        device_id,
        device_secret,
        token,
        printer,
        heartbeat_interval=10,
    ):

        self.backend_url = backend_url.rstrip("/")
        self.device_id = device_id
        self.device_secret = device_secret
        self.token = token
        self.printer = printer

        self.heartbeat_interval = heartbeat_interval

        self.running = True

        # Prevent multiple simultaneous connection attempts.
        self.connecting = False

        self.sio = socketio.AsyncClient(
            reconnection=False,
            logger=False,
            engineio_logger=False,
        )

        self._register_events()

    # ==========================================
    # SOCKET EVENTS
    # ==========================================

    def _register_events(self):

        @self.sio.event(namespace="/printers")
        async def connect():

            print("")
            print("======================================")
            print("🟢 CONNECTED TO DINEFLOW")
            print("======================================")
            print("")

            print("Device ID:", self.device_id)
            print("Printer Agent is ONLINE.")
            print("Waiting for print jobs...")
            print("")

            # Start heartbeat only after successful connection.
            asyncio.create_task(
                self._heartbeat_loop()
            )

        @self.sio.event(namespace="/printers")
        async def disconnect():

            print("")
            print("======================================")
            print("🔴 DISCONNECTED FROM DINEFLOW")
            print("======================================")
            print("")

            print("Device ID:", self.device_id)
            print("Waiting for automatic reconnection...")
            print("")

        @self.sio.event(namespace="/printers")
        async def connect_error(data):

            print("")
            print("❌ DineFlow connection error:")
            print(data)
            print("")

        @self.sio.on(
            "printer:print-job",
            namespace="/printers",
        )
        async def handle_print_job(data):

            await self._handle_print_job(data)

    # ==========================================
    # CONNECT TO DINEFLOW
    # ==========================================

    async def connect(self):

        # Prevent duplicate simultaneous connections.
        if self.sio.connected:
            return

        if self.connecting:
            return

        self.connecting = True

        try:

            print("")
            print("🔌 Connecting Printer Agent to DineFlow...")
            print("")

            print("Backend:", self.backend_url)
            print("Namespace: /printers")
            print("")

            await self.sio.connect(
                self.backend_url,
                namespaces=["/printers"],
                auth={
                    "token": self.token,
                    "deviceId": self.device_id,
                    "deviceSecret": self.device_secret,
                },
            )

        finally:

            self.connecting = False

    # ==========================================
    # HEARTBEAT
    # ==========================================

    async def _heartbeat_loop(self):

        while self.running:

            try:

                if not self.sio.connected:

                    return

                await self.sio.emit(
                    "printer:heartbeat",
                    {
                        "deviceId": self.device_id,
                    },
                    namespace="/printers",
                )

                print("💓 Heartbeat sent")

            except Exception as error:

                print(
                    "⚠️ Heartbeat error:",
                    error,
                )

                return

            await asyncio.sleep(
                self.heartbeat_interval
            )

    # ==========================================
    # PRINT JOB
    # ==========================================

    async def _handle_print_job(self, data):

        print("")
        print("======================================")
        print("🖨️ NEW PRINT JOB")
        print("======================================")
        print("")

        job_id = data.get("jobId")
        payload = data.get("payload", {})

        if not job_id:

            print(
                "❌ Print job does not contain jobId"
            )

            return

        print("Job ID:", job_id)

        try:

            # ----------------------------------
            # TELL BACKEND JOB WAS RECEIVED
            # ----------------------------------

            await self.sio.emit(
                "printer:job-received",
                {
                    "jobId": job_id,
                },
                namespace="/printers",
            )

            print("📥 Job received")

            # ----------------------------------
            # BUILD RECEIPT
            # ----------------------------------

            print_data = self._build_receipt(
                payload
            )

            print("🖨️ Printing...")

            # ----------------------------------
            # PRINT THROUGH PSF588
            # ----------------------------------

            await self.printer.print_bytes(
                print_data
            )

            # ----------------------------------
            # TELL BACKEND PRINT SUCCEEDED
            # ----------------------------------

            await self.sio.emit(
                "printer:job-printed",
                {
                    "jobId": job_id,
                },
                namespace="/printers",
            )

            print("")
            print("✅ Print job completed")
            print("")

        except Exception as error:

            print("")
            print("❌ Printing failed:")
            print(error)
            print("")

            try:

                await self.sio.emit(
                    "printer:job-failed",
                    {
                        "jobId": job_id,
                        "error": {
                            "code": "PRINT_ERROR",
                            "message": str(error),
                        },
                    },
                    namespace="/printers",
                )

            except Exception as socket_error:

                print(
                    "⚠️ Could not report print failure:",
                    socket_error,
                )

    # ==========================================
    # BUILD RECEIPT
    # ==========================================

    def _build_receipt(self, payload):

        # ==========================================
        # BILLING DATA
        # ==========================================

        bill_number = str(
            payload.get(
                "billNumber",
                "",
            )
        )

        table_number = str(
            payload.get(
                "tableNumber",
                "",
            )
        )

        order_count = payload.get(
            "orderCount",
            0,
        )

        items = payload.get(
            "items",
            [],
        )

        total_items = payload.get(
            "totalItems",
            0,
        )

        subtotal = payload.get(
            "subtotal",
            0,
        )

        cgst = payload.get(
            "cgst",
            0,
        )

        sgst = payload.get(
            "sgst",
            0,
        )

        tax = payload.get(
            "tax",
            0,
        )

        total = payload.get(
            "total",
            payload.get(
                "totalPrice",
                0,
            ),
        )

        # ==========================================
        # ESC/POS COMMANDS
        # ==========================================

        init = bytes([
            0x1B,
            0x40,
        ])

        center = bytes([
            0x1B,
            0x61,
            0x01,
        ])

        left = bytes([
            0x1B,
            0x61,
            0x00,
        ])

        bold_on = bytes([
            0x1B,
            0x45,
            0x01,
        ])

        bold_off = bytes([
            0x1B,
            0x45,
            0x00,
        ])

        double_on = bytes([
            0x1D,
            0x21,
            0x11,
        ])

        double_off = bytes([
            0x1D,
            0x21,
            0x00,
        ])

        feed = bytes([
            0x1B,
            0x64,
            0x04,
        ])

        # ==========================================
        # HELPERS
        # ==========================================

        def encode(text):

            return str(text).encode(
                "ascii",
                errors="replace",
            )

        def money(value):

            try:

                return f"Rs {float(value):.2f}"

            except (
                TypeError,
                ValueError,
            ):

                return f"Rs {value}"

        def format_item(
            name,
            quantity,
            price,
        ):

            try:

                qty = float(quantity)

            except (
                TypeError,
                ValueError,
            ):

                qty = 0

            try:

                unit_price = float(price)

            except (
                TypeError,
                ValueError,
            ):

                unit_price = 0

            amount = qty * unit_price

            if qty.is_integer():

                qty_text = str(
                    int(qty)
                )

            else:

                qty_text = str(qty)

            name_text = str(name)

            # Thermal printer width:
            # approximately 32 characters.

            first_line = (
                name_text[:32]
                + "\n"
            )

            second_line = (
                f"{qty_text} x "
                f"{money(unit_price)}"
            )

            amount_text = money(
                amount
            )

            available_spaces = (
                32
                - len(second_line)
                - len(amount_text)
            )

            if available_spaces < 1:

                available_spaces = 1

            second_line += (
                " "
                * available_spaces
            )

            second_line += (
                amount_text
                + "\n"
            )

            return (
                first_line
                + second_line
            )

        # ==========================================
        # BUILD RECEIPT
        # ==========================================

        receipt = b""

        # ==========================================
        # HEADER
        # ==========================================

        receipt += init

        receipt += center

        receipt += bold_on

        receipt += double_on

        receipt += encode(
            "THE RAMS'S KITCHEN\n"
        )

        receipt += double_off

        receipt += bold_off

        receipt += encode(
            "--------------------------------\n"
        )

        receipt += bold_on

        receipt += encode(
            "BILL RECEIPT\n"
        )

        receipt += bold_off

        receipt += encode(
            "--------------------------------\n"
        )

        # ==========================================
        # BILL INFORMATION
        # ==========================================

        receipt += left

        receipt += encode(
            f"Bill No : {bill_number}\n"
        )

        receipt += encode(
            f"Table   : {table_number}\n"
        )

        receipt += encode(
            f"Orders  : {order_count}\n"
        )

        receipt += encode(
            "--------------------------------\n"
        )

        # ==========================================
        # ITEMS
        # ==========================================

        receipt += bold_on

        receipt += encode(
            "ITEMS\n"
        )

        receipt += bold_off

        receipt += encode(
            "--------------------------------\n"
        )

        for item in items:

            name = str(
                item.get(
                    "name",
                    "Item",
                )
            )

            quantity = item.get(
                "quantity",
                0,
            )

            price = item.get(
                "price",
                0,
            )

            receipt += encode(
                format_item(
                    name,
                    quantity,
                    price,
                )
            )

        receipt += encode(
            "--------------------------------\n"
        )

        # ==========================================
        # SUMMARY
        # ==========================================

        receipt += encode(
            f"Items       : {total_items}\n"
        )

        receipt += encode(
            f"Subtotal    : {money(subtotal)}\n"
        )

        receipt += encode(
            f"CGST        : {money(cgst)}\n"
        )

        receipt += encode(
            f"SGST        : {money(sgst)}\n"
        )

        receipt += encode(
            f"Tax         : {money(tax)}\n"
        )

        receipt += encode(
            "--------------------------------\n"
        )

        # ==========================================
        # TOTAL
        # ==========================================

        receipt += bold_on

        receipt += double_on

        receipt += encode(
            f"TOTAL: {money(total)}\n"
        )

        receipt += double_off

        receipt += bold_off

        receipt += encode(
            "--------------------------------\n"
        )

        # ==========================================
        # FOOTER
        # ==========================================

        receipt += center

        receipt += bold_on

        receipt += encode(
            "THANK YOU!\n"
        )

        receipt += bold_off

        receipt += encode(
            "VISIT AGAIN\n"
        )

        receipt += b"\n"

        receipt += feed

        return receipt

    # ==========================================
    # RUN
    # ==========================================

    async def run(self):

        while self.running:

            try:

                # ----------------------------------
                # CONNECT ONLY IF NOT CONNECTED
                # ----------------------------------

                if not self.sio.connected:

                    if not self.connecting:

                        print("")
                        print(
                            "🔄 Attempting DineFlow connection..."
                        )
                        print("")

                        try:

                            await self.connect()

                        except Exception as error:

                            print("")
                            print(
                                "⚠️ DineFlow connection failed:"
                            )
                            print(error)
                            print("")

                            # Make sure the client is
                            # completely cleaned up.

                            try:

                                if self.sio.connected:

                                    await self.sio.disconnect()

                            except Exception:
                                pass

                            await asyncio.sleep(5)

                            continue

                # ----------------------------------
                # CONNECTION IS ACTIVE
                # ----------------------------------

                await asyncio.sleep(2)

            except asyncio.CancelledError:

                raise

            except Exception as error:

                print("")
                print(
                    "⚠️ Printer Agent error:"
                )
                print(error)
                print("")

                await asyncio.sleep(5)

    # ==========================================
    # STOP
    # ==========================================

    async def stop(self):

        self.running = False

        try:

            if self.sio.connected:

                await self.sio.disconnect()

        except Exception:

            pass