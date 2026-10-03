/* eslint-disable react-native/no-inline-styles */

import React, {

  useEffect,

  useRef,

  useState,

} from "react";



import {

  Alert,

  PermissionsAndroid,

  Platform,

  SafeAreaView,

  ScrollView,

  StyleSheet,

  Text,

  TouchableOpacity,

  View,

} from "react-native";



import AsyncStorage from "@react-native-async-storage/async-storage";



import {

  ReactNativePosPrinter,

  ThermalPrinterDevice,

} from "react-native-thermal-pos-printer";



import {

  connectSocket,

  disconnectSocket,

  socket,

} from "../socket/socket";



import type { DineFlowOrder } from "../types/order";



type PrinterDevice = ThermalPrinterDevice & {

  name?: string;

  address?: string;

};



type ReceiptSize =

  | "compact"

  | "normal"

  | "large";



interface PrinterScreenProps {

  userName: string;

  restaurantName: string;

  restaurantId: string;

  userRole: "admin" | "staff";

}



const RECEIPT_SIZE_KEY =

  "@dineflow_receipt_size";



const RECEIPT_CONFIG = {

  compact: {

    label: "Compact",

    description: "Shortest receipt",

    width: 24,

    textSize: 8,

    headerSize: 12,

    totalSize: 10,

    restaurantSize: 12,

  },



  normal: {

    label: "Normal",

    description: "Balanced size",

    width: 28,

    textSize: 11,

    headerSize: 16,

    totalSize: 16,

    restaurantSize: 18,

  },



  large: {

    label: "Large",

    description: "Larger text",

    width: 28,

    textSize: 13,

    headerSize: 18,

    totalSize: 18,

    restaurantSize: 20,

  },

};



function PrinterScreen({

  userName,

  restaurantName,

  restaurantId,

  userRole,

}: PrinterScreenProps) {

  const [printers, setPrinters] = useState<

    PrinterDevice[]

  >([]);



  const [connectedPrinter, setConnectedPrinter] =

    useState<PrinterDevice | null>(null);



  const connectedPrinterRef =

    useRef<PrinterDevice | null>(null);



  const printedOrdersRef =

    useRef<Set<string>>(new Set());



  const printingOrdersRef =

    useRef<Set<string>>(new Set());


  const printedBillsRef =

    useRef<Set<string>>(new Set());


  const printingBillsRef =

    useRef<Set<string>>(new Set());



  const [loading, setLoading] =

    useState(false);



  const [printing, setPrinting] =

    useState(false);



  const [status, setStatus] = useState(

    "Initializing printer system..."

  );



  const [socketConnected, setSocketConnected] =

    useState(false);



  const [lastOrder, setLastOrder] =

    useState<DineFlowOrder | null>(null);



  const [receiptSize, setReceiptSize] =

    useState<ReceiptSize>("normal");



  /*

   * Load saved receipt size.

   *

   * Admin controls the receipt size.

   * Staff uses Compact automatically.

   */

  useEffect(() => {

    const loadReceiptSize = async () => {

      try {

        if (userRole !== "admin") {

          setReceiptSize("compact");

          return;

        }



        const savedSize =

          await AsyncStorage.getItem(

            RECEIPT_SIZE_KEY

          );



        if (

          savedSize === "compact" ||

          savedSize === "normal" ||

          savedSize === "large"

        ) {

          setReceiptSize(savedSize);

        }

      } catch (error) {

        console.error(

          "Failed to load receipt size:",

          error

        );

      }

    };



    loadReceiptSize();

  }, [userRole]);



  /*

   * Save receipt size.

   */

  const changeReceiptSize = async (

    size: ReceiptSize

  ) => {

    try {

      setReceiptSize(size);



      if (userRole === "admin") {

        await AsyncStorage.setItem(

          RECEIPT_SIZE_KEY,

          size

        );

      }



      setStatus(

        `${RECEIPT_CONFIG[size].label} receipt selected.`

      );

    } catch (error) {

      console.error(

        "Failed to save receipt size:",

        error

      );

    }

  };



  const receiptConfig =

    RECEIPT_CONFIG[receiptSize];



  const RECEIPT_WIDTH =

    receiptConfig.width;



  const separator =

    "-".repeat(RECEIPT_WIDTH);



  /*

   * Center text.

   */

  const centerText = (

    text: string

  ) => {

    const value = text.trim();



    if (!value) {

      return "-";

    }



    if (

      value.length >= RECEIPT_WIDTH

    ) {

      return value.substring(

        0,

        RECEIPT_WIDTH

      );

    }



    const totalSpaces =

      RECEIPT_WIDTH - value.length;



    const leftSpaces =

      Math.floor(totalSpaces / 2);



    const rightSpaces =

      totalSpaces - leftSpaces;



    return (

      " ".repeat(leftSpaces) +

      value +

      " ".repeat(rightSpaces)

    );

  };



  /*

   * Wrap long text.

   */

  const wrapText = (

    text: string,

    width: number

  ): string[] => {

    const cleanText =

      String(text || "").trim();



    if (!cleanText) {

      return ["Unknown"];

    }



    const words =

      cleanText.split(/\s+/);



    const lines: string[] = [];



    let currentLine = "";



    for (const word of words) {

      if (word.length > width) {

        if (currentLine) {

          lines.push(currentLine);

          currentLine = "";

        }



        for (

          let i = 0;

          i < word.length;

          i += width

        ) {

          lines.push(

            word.substring(

              i,

              i + width

            )

          );

        }



        continue;

      }



      const candidate =

        currentLine

          ? `${currentLine} ${word}`

          : word;



      if (

        candidate.length <= width

      ) {

        currentLine = candidate;

      } else {

        if (currentLine) {

          lines.push(currentLine);

        }



        currentLine = word;

      }

    }



    if (currentLine) {

      lines.push(currentLine);

    }



    return lines.length

      ? lines

      : ["Unknown"];

  };



  /*

   * Create compact admin item lines.

   *

   * Example:

   *

   * Paneer Biryani       2

   * 150 x 2 = 300

   */

  const createAdminItemLines = (

    name: string,

    quantity: number,

    price: number

  ): string[] => {

    const itemLines =

      wrapText(

        name,

        RECEIPT_WIDTH

      );



    const lines: string[] = [];



    itemLines.forEach(

      (line, index) => {

        if (index === 0) {

          lines.push(

            `${line} x${quantity}`

          );

        } else {

          lines.push(line);

        }

      }

    );



    lines.push(

      `${price} x ${quantity} = ${

        price * quantity

      }`

    );



    return lines;

  };



  /*

   * Staff item lines.

   */

  /* Receipt date/time using printer device local time. */
  const formatReceiptDateTime = (date = new Date()) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return { date: `${day}/${month}/${year}`, time: `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${period}` };
  };

  const createStaffItemLines = (

    name: string,

    quantity: number

  ): string[] => {

    const itemLines =

      wrapText(

        name,

        RECEIPT_WIDTH - 4

      );



    return itemLines.map(

      (line, index) => {

        if (index === 0) {

          return `${line} x${quantity}`;

        }



        return line;

      }

    );

  };



  /*

   * PRINTER INITIALIZATION

   */

  useEffect(() => {

    initializePrinter();



    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  /*

   * AUTOMATIC ORDER PRINTING

   */

  const printOrder = async (

    order: DineFlowOrder

  ) => {

    const printer =

      connectedPrinterRef.current;



    if (!printer) {

      console.warn(

        "⚠️ Order received but no printer is connected:",

        order.orderId

      );



      setStatus(

        `Order #${order.orderId} received. Connect printer to print.`

      );



      return;

    }



    const orderKey =

      String(order._id);



    /*

     * Prevent duplicate printing.

     */

    if (

      printedOrdersRef.current.has(

        orderKey

      )

    ) {

      console.log(

        "⏭️ Order already printed:",

        order.orderId

      );



      return;

    }



    /*

     * Prevent simultaneous duplicate printing.

     */

    if (

      printingOrdersRef.current.has(

        orderKey

      )

    ) {

      console.log(

        "⏳ Order is already being printed:",

        order.orderId

      );



      return;

    }



    printingOrdersRef.current.add(

      orderKey

    );



    try {

      setPrinting(true);



      setStatus(

        `Printing order #${order.orderId}...`

      );



      console.log(

        "🖨️ Starting automatic print:",

        order.orderId

      );



      /*

       * RESTAURANT HEADER

       */



      const restaurantLines =

        wrapText(

          restaurantName,

          RECEIPT_WIDTH

        );



      for (

        const line of restaurantLines

      ) {

        await printer.printText(

          `${centerText(line)}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig

                .restaurantSize,

            bold: true,

          }

        );

      }



      /*

       * RECEIPT TYPE

       */



      await printer.printText(

        userRole === "admin"

          ? "CUSTOMER RECEIPT\n"

          : "KITCHEN ORDER\n",

        {

          align: "CENTER",

          size:

            receiptConfig.headerSize,

          bold: true,

        }

      );



      /*

       * ORDER INFO

       */



      await printer.printText(

        `${separator}\n`,

        {

          align: "CENTER",

          size:

            receiptConfig.textSize,

        }

      );



      await printer.printText(

        `ORDER: ${order.orderId}\n`,

        {

          align: "LEFT",

          size:

            receiptConfig.textSize,

          bold: true,

        }

      );



      await printer.printText(

        `TABLE: ${order.tableNumber}\n`,

        {

          align: "LEFT",

          size:

            receiptConfig.textSize,

          bold: true,

        }

      );



      /*

      const orderDateTime = formatReceiptDateTime();

      await printer.printText(`DATE: ${orderDateTime.date}\n`, { align: "LEFT", size: receiptConfig.textSize });
      await printer.printText(`TIME: ${orderDateTime.time}\n`, { align: "LEFT", size: receiptConfig.textSize });

       * ITEMS

       */



      await printer.printText(

        `${separator}\n`,

        {

          align: "CENTER",

          size:

            receiptConfig.textSize,

        }

      );



      await printer.printText(

        "ITEM                 QTY\n",

        {

          align: "LEFT",

          size:

            receiptConfig.textSize,

          bold: true,

        }

      );



      await printer.printText(

        `${separator}\n`,

        {

          align: "CENTER",

          size:

            receiptConfig.textSize,

        }

      );



      /*

       * ADMIN ITEMS

       */

      if (userRole === "admin") {

        for (

          const item of order.items

        ) {

          const itemLines =

            createAdminItemLines(

              item.name,

              item.quantity,

              item.price

            );



          for (

            const line of itemLines

          ) {

            await printer.printText(

              `${line}\n`,

              {

                align: "LEFT",

                size:

                  receiptConfig.textSize,

              }

            );

          }

        }

      } else {

        /*

         * STAFF ITEMS

         */

        for (

          const item of order.items

        ) {

          const itemLines =

            createStaffItemLines(

              item.name,

              item.quantity

            );



          for (

            const line of itemLines

          ) {

            await printer.printText(

              `${line}\n`,

              {

                align: "LEFT",

                size:

                  receiptConfig.textSize,

                bold:

                  line.includes(" x"),

              }

            );

          }

        }

      }



      /*

       * TOTALS

       */



      await printer.printText(

        `${separator}\n`,

        {

          align: "CENTER",

          size:

            receiptConfig.textSize,

        }

      );



      const totalQuantity =

        order.items.reduce(

          (sum, item) =>

            sum + item.quantity,

          0

        );



      await printer.printText(

        `ITEMS: ${order.totalItems}\n`,

        {

          align: "LEFT",

          size:

            receiptConfig.textSize,

          bold: true,

        }

      );



      await printer.printText(

        `QTY: ${totalQuantity}\n`,

        {

          align: "LEFT",

          size:

            receiptConfig.textSize,

          bold: true,

        }

      );



      /*

       * ADMIN TOTAL

       */

      if (userRole === "admin") {

        await printer.printText(

          `${separator}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

          }

        );



        await printer.printText(

          `TOTAL: Rs.${order.totalPrice}\n`,

          {

            align: "RIGHT",

            size:

              receiptConfig.totalSize,

            bold: true,

          }

        );

      }



      /*

       * FOOTER

       */



      await printer.printText(

        `${separator}\n`,

        {

          align: "CENTER",

          size:

            receiptConfig.textSize,

        }

      );



      await printer.printText(

        "Thank You! Visit Again!\n",

        {

          align: "CENTER",

          size:

            receiptConfig.textSize,

          bold: true,

        }

      );



      /*

       * IMPORTANT:

       *

       * The printer library rejects

       * empty strings.

       *

       * Keep this non-empty.

       */

      await printer.printText(

        "END"

      );



      /*

       * Mark as printed only after

       * complete receipt succeeds.

       */

      printedOrdersRef.current.add(

        orderKey

      );



      setStatus(

        `Order #${order.orderId} printed successfully.`

      );



      console.log(

        "🧾 ORDER PRINTED SUCCESSFULLY:",

        order.orderId

      );

    } catch (error) {

      console.error(

        "❌ Automatic order printing failed:",

        error

      );



      setStatus(

        `Failed to print order #${order.orderId}.`

      );



      Alert.alert(

        "Automatic Print Failed",

        `Order #${order.orderId} was received but could not be printed.\n\n${String(

          error

        )}`

      );

    } finally {

      printingOrdersRef.current.delete(

        orderKey

      );



      setPrinting(false);

    }

  };



  /*

   * FINAL BILL PRINTING

   */

  /*
   * Final customer-bill item layout:
   * Item Name     Qty   Rate   Total
   * Biryani        2    180     360
   */
  const createBillColumnLine = (
    name: string,
    quantity: number,
    rate: number,
    total: number
  ): string[] => {
    const nameWidth = RECEIPT_WIDTH <= 24 ? 9 : 12;
    const qtyWidth = RECEIPT_WIDTH <= 24 ? 3 : 4;
    const rateWidth = RECEIPT_WIDTH <= 24 ? 5 : 6;
    const totalWidth = RECEIPT_WIDTH - nameWidth - qtyWidth - rateWidth;

    const nameLines = wrapText(name, nameWidth);
    const lines: string[] = [];

    nameLines.forEach((line, index) => {
      if (index === 0) {
        lines.push(
          line.padEnd(nameWidth, " ") +
          String(quantity).padStart(qtyWidth, " ") +
          String(rate).padStart(rateWidth, " ") +
          String(total).padStart(totalWidth, " ")
        );
      } else {
        lines.push(line);
      }
    });

    return lines;
  };

  const printFinalBill = async (
    billData: {
      sessionId: string;
      restaurantId: string;
      orderId: number;
      tableId: string;
      tableNumber: number;
      orderCount: number;
      items: Array<{
        id: string;
        name: string;
        price: number;
        category?: string;
        quantity: number;
      }>;
      totalItems: number;
      totalQuantity: number;
      totalPrice: number;
      status: string;
    }
  ) => {
    if (userRole !== "admin") {
      console.log("⏭️ Staff printer ignoring final bill:", billData.orderId);
      return;
    }

    const printer = connectedPrinterRef.current;

    if (!printer) {
      console.warn("⚠️ Final bill received but no printer is connected:", billData.orderId);
      setStatus(`Final bill #${billData.orderId} received. Connect printer to print.`);
      return;
    }

    const billKey = String(billData.sessionId);

    if (printedBillsRef.current.has(billKey)) {
      console.log("⏭️ Final bill already printed:", billData.orderId);
      return;
    }

    if (printingBillsRef.current.has(billKey)) {
      console.log("⏳ Final bill is already being printed:", billData.orderId);
      return;
    }

    printingBillsRef.current.add(billKey);

    try {
      setPrinting(true);
      setStatus(`Printing final bill #${billData.orderId}...`);

      const restaurantLines = wrapText(restaurantName, RECEIPT_WIDTH);

      for (const line of restaurantLines) {
        await printer.printText(`${centerText(line)}\n`, {
          align: "CENTER",
          size: receiptConfig.restaurantSize,
          bold: true,
        });
      }

      await printer.printText("FINAL BILL\n", {
        align: "CENTER",
        size: receiptConfig.headerSize,
        bold: true,
      });

      await printer.printText(`${separator}\n`, {
        align: "CENTER",
        size: receiptConfig.textSize,
      });

      await printer.printText(`Bill No: ${billData.orderId}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
        bold: true,
      });
      await printer.printText(`Table No: ${billData.tableNumber}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
        bold: true,
      });
      await printer.printText(`Orders: ${billData.orderCount}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
      });

      const billDateTime = formatReceiptDateTime();
      await printer.printText(`Date: ${billDateTime.date}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
      });
      await printer.printText(`Time: ${billDateTime.time}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
      });

      await printer.printText(`${separator}\n`, {
        align: "CENTER",
        size: receiptConfig.textSize,
      });

      const nameWidth = RECEIPT_WIDTH <= 24 ? 9 : 12;
      const qtyWidth = RECEIPT_WIDTH <= 24 ? 3 : 4;
      const rateWidth = RECEIPT_WIDTH <= 24 ? 5 : 6;
      const totalWidth = RECEIPT_WIDTH - nameWidth - qtyWidth - rateWidth;

      const columnHeader =
        "Item Name".padEnd(nameWidth, " ") +
        "Qty".padStart(qtyWidth, " ") +
        "Rate".padStart(rateWidth, " ") +
        "Total".padStart(totalWidth, " ");

      await printer.printText(`${columnHeader}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
        bold: true,
      });

      await printer.printText(`${separator}\n`, {
        align: "CENTER",
        size: receiptConfig.textSize,
      });

      for (const item of billData.items) {
        const itemTotal = item.price * item.quantity;
        const itemLines = createBillColumnLine(
          item.name,
          item.quantity,
          item.price,
          itemTotal
        );

        for (const line of itemLines) {
          await printer.printText(`${line}\n`, {
            align: "LEFT",
            size: receiptConfig.textSize,
          });
        }
      }

      await printer.printText(`${separator}\n`, {
        align: "CENTER",
        size: receiptConfig.textSize,
      });

      await printer.printText(`Total Items: ${billData.totalItems}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
        bold: true,
      });
      await printer.printText(`Total Quantity: ${billData.totalQuantity}\n`, {
        align: "LEFT",
        size: receiptConfig.textSize,
        bold: true,
      });

      await printer.printText(`${separator}\n`, {
        align: "CENTER",
        size: receiptConfig.textSize,
      });

      await printer.printText(`TOTAL: Rs.${billData.totalPrice}\n`, {
        align: "RIGHT",
        size: receiptConfig.totalSize,
        bold: true,
      });

      await printer.printText(`${separator}\n`, {
        align: "CENTER",
        size: receiptConfig.textSize,
      });

      await printer.printText("Thank You! Visit Again!\n", {
        align: "CENTER",
        size: receiptConfig.textSize,
        bold: true,
      });
      await printer.printText("END");

      printedBillsRef.current.add(billKey);
      setStatus(`Final bill #${billData.orderId} printed successfully.`);
      console.log("🧾 FINAL BILL PRINTED SUCCESSFULLY:", billData.orderId);
    } catch (error) {
      console.error("❌ Final bill printing failed:", error);
      setStatus(`Failed to print final bill #${billData.orderId}.`);
      Alert.alert("Final Bill Print Failed", `Final bill #${billData.orderId} was received but could not be printed.\n\n${String(error)}`);
    } finally {
      printingBillsRef.current.delete(billKey);
      setPrinting(false);
    }
  };


  /*

   * SOCKET.IO

   */

  useEffect(() => {

    if (!restaurantId) {

      return;

    }



    const handleConnect = () => {

      console.log(

        "🟢 DineFlow Socket connected:",

        socket.id

      );



      setSocketConnected(true);

    };



    const handleDisconnect = (

      reason: string

    ) => {

      console.log(

        "🔴 DineFlow Socket disconnected:",

        reason

      );



      setSocketConnected(false);

    };



    const handleNewOrder = async (

      order: DineFlowOrder

    ) => {

      console.log(

        "🧾 NEW ORDER RECEIVED:",

        order

      );



      /*

       * Restaurant isolation.

       */

      if (

        String(order.restaurantId) !==

        String(restaurantId)

      ) {

        console.warn(

          "⚠️ Ignoring order from another restaurant:",

          order.restaurantId

        );



        return;

      }



      setLastOrder(order);



      await printOrder(order);

    };



  const handleBillRequested = async (
    billData: {
      sessionId: string;
      restaurantId: string;
      orderId: number;
      tableId: string;
      tableNumber: number;
      orderCount: number;
      items: Array<{
        id: string;
        name: string;
        price: number;
        category?: string;
        quantity: number;
      }>;
      totalItems: number;
      totalQuantity: number;
      totalPrice: number;
      status: string;
    }
  ) => {
    console.log("🧾 FINAL BILL REQUEST RECEIVED:", billData);

    if (String(billData.restaurantId) !== String(restaurantId)) {
      console.warn("⚠️ Ignoring bill from another restaurant:", billData.restaurantId);
      return;
    }

    if (userRole !== "admin") {
      console.log("⏭️ Staff printer ignoring final bill:", billData.orderId);
      return;
    }

    await printFinalBill(billData);
  };



    socket.on(

      "connect",

      handleConnect

    );



    socket.on(

      "disconnect",

      handleDisconnect

    );



    // Staff printers receive kitchen orders.
    // Admin printers receive only the final bill.
    if (userRole === "staff") {
      socket.on(
        "new-order",
        handleNewOrder
      );
    }



    socket.on(

      "bill-requested",

      handleBillRequested

    );



    connectSocket(restaurantId);



    return () => {

      socket.off(

        "connect",

        handleConnect

      );



      socket.off(

        "disconnect",

        handleDisconnect

      );



      if (userRole === "staff") {
        socket.off(
          "new-order",
          handleNewOrder
        );
      }



      socket.off(

      "bill-requested",

      handleBillRequested

    );



    disconnectSocket();

    };



    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [restaurantId]);



  /*

   * BLUETOOTH PERMISSIONS

   */

  const requestBluetoothPermissions =

    async () => {

      if (Platform.OS !== "android") {

        return true;

      }



      if (Platform.Version >= 31) {

        const result =

          await PermissionsAndroid.requestMultiple(

            [

              PermissionsAndroid.PERMISSIONS

                .BLUETOOTH_SCAN,



              PermissionsAndroid.PERMISSIONS

                .BLUETOOTH_CONNECT,

            ]

          );



        return (

          result[

            PermissionsAndroid.PERMISSIONS

              .BLUETOOTH_SCAN

          ] ===

            PermissionsAndroid.RESULTS

              .GRANTED &&

          result[

            PermissionsAndroid.PERMISSIONS

              .BLUETOOTH_CONNECT

          ] ===

            PermissionsAndroid.RESULTS

              .GRANTED

        );

      }



      const result =

        await PermissionsAndroid.request(

          PermissionsAndroid.PERMISSIONS

            .ACCESS_FINE_LOCATION

        );



      return (

        result ===

        PermissionsAndroid.RESULTS

          .GRANTED

      );

    };



  /*

   * FIND PRINTERS

   */

  const initializePrinter =

    async () => {

      try {

        setLoading(true);



        setStatus(

          "Requesting Bluetooth permission..."

        );



        const permissionGranted =

          await requestBluetoothPermissions();



        if (!permissionGranted) {

          setStatus(

            "Bluetooth permission denied."

          );



          return;

        }



        setStatus(

          "Initializing printer..."

        );



        await ReactNativePosPrinter.init();



        setStatus(

          "Searching for paired printers..."

        );



        const devices =

          await ReactNativePosPrinter.getDeviceList();



        const printerDevices =

          devices as PrinterDevice[];



        setPrinters(

          printerDevices

        );



        if (

          printerDevices.length === 0

        ) {

          setStatus(

            "No paired Bluetooth printers found."

          );

        } else {

          setStatus(

            `${printerDevices.length} printer(s) found.`

          );

        }

      } catch (error) {

        console.error(

          "Printer initialization error:",

          error

        );



        setStatus(

          "Failed to initialize printer."

        );



        Alert.alert(

          "Printer Error",

          String(error)

        );

      } finally {

        setLoading(false);

      }

    };



  /*

   * CONNECT PRINTER

   */

  const connectPrinter = async (

    printer: PrinterDevice

  ) => {

    try {

      setLoading(true);



      setStatus(

        `Connecting to ${

          printer.name || "printer"

        }...`

      );



      await printer.connect({

        timeout: 5000,

        encoding: "UTF-8",

      });



      setConnectedPrinter(

        printer

      );



      connectedPrinterRef.current =

        printer;



      setStatus(

        `Connected to ${

          printer.name || "SC588"

        }`

      );



      Alert.alert(

        "Printer Connected",

        `${

          printer.name || "SC588"

        } is connected successfully.`

      );

    } catch (error) {

      console.error(

        "Printer connection error:",

        error

      );



      setStatus(

        "Failed to connect to printer."

      );



      Alert.alert(

        "Connection Failed",

        String(error)

      );

    } finally {

      setLoading(false);

    }

  };



  /*

   * TEST RECEIPT

   */

  const printTestReceipt =

    async () => {

      if (!connectedPrinter) {

        Alert.alert(

          "Printer Not Connected",

          "Please connect the SC588 printer first."

        );



        return;

      }



      try {

        setPrinting(true);



        setStatus(

          "Printing test receipt..."

        );



        /*

         * Restaurant name

         */

        const restaurantLines =

          wrapText(

            restaurantName,

            RECEIPT_WIDTH

          );



        for (

          const line of restaurantLines

        ) {

          await connectedPrinter.printText(

            `${centerText(line)}\n`,

            {

              align: "CENTER",

              size:

                receiptConfig

                  .restaurantSize,

              bold: true,

            }

          );

        }



        await connectedPrinter.printText(

          "TEST RECEIPT\n",

          {

            align: "CENTER",

            size:

              receiptConfig.headerSize,

            bold: true,

          }

        );



        await connectedPrinter.printText(

          `${separator}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "ORDER: 1001\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

            bold: true,

          }

        );



        await connectedPrinter.printText(

          "TABLE: 5\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

            bold: true,

          }

        );



        await connectedPrinter.printText(

          `${separator}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "ITEM                 QTY\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

            bold: true,

          }

        );



        await connectedPrinter.printText(

          `${separator}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "Paneer Biryani x2\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "150 x 2 = 300\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "Masala Dosa x1\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "100 x 1 = 100\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          `${separator}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "ITEMS: 2\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

            bold: true,

          }

        );



        await connectedPrinter.printText(

          "QTY: 3\n",

          {

            align: "LEFT",

            size:

              receiptConfig.textSize,

            bold: true,

          }

        );



        await connectedPrinter.printText(

          `${separator}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "TOTAL: Rs.400\n",

          {

            align: "RIGHT",

            size:

              receiptConfig.totalSize,

            bold: true,

          }

        );



        await connectedPrinter.printText(

          `${separator}\n`,

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

          }

        );



        await connectedPrinter.printText(

          "Thank You! Visit Again!\n",

          {

            align: "CENTER",

            size:

              receiptConfig.textSize,

            bold: true,

          }

        );



        /*

         * Never send an empty string.

         */

        await connectedPrinter.printText(

          "END"

        );



        setStatus(

          "Test receipt printed successfully."

        );



        Alert.alert(

          "Success",

          `${receiptConfig.label} test receipt sent to the SC588.`

        );

      } catch (error) {

        console.error(

          "Print error:",

          error

        );



        setStatus(

          "Printing failed."

        );



        Alert.alert(

          "Print Failed",

          String(error)

        );

      } finally {

        setPrinting(false);

      }

    };



  return (

    <SafeAreaView

      style={styles.safeArea}

    >

      <ScrollView

        contentContainerStyle={

          styles.container

        }

      >

        <Text style={styles.logo}>

          DineFlow

        </Text>



        <Text style={styles.title}>

          Printer

        </Text>



        <Text style={styles.subtitle}>

          {restaurantName}

        </Text>



        {/* USER */}



        <View style={styles.userCard}>

          <View>

            <Text

              style={

                styles.userLabel

              }

            >

              LOGGED IN AS

            </Text>



            <Text

              style={

                styles.userName

              }

            >

              {userName}

            </Text>

          </View>



          <View style={styles.roleBadge}>

            <Text

              style={

                styles.roleText

              }

            >

              {userRole.toUpperCase()}

            </Text>

          </View>

        </View>



        {/* RECEIPT SIZE */}



        {userRole === "admin" && (

          <View

            style={

              styles.receiptSettingsCard

            }

          >

            <Text

              style={

                styles.sectionTitle

              }

            >

              Receipt Size

            </Text>



            <Text

              style={

                styles.receiptSettingsDescription

              }

            >

              Choose how the 2-inch SC588

              receipt should be printed.

            </Text>



            <View

              style={

                styles.sizeButtons

              }

            >

              {(

                Object.keys(

                  RECEIPT_CONFIG

                ) as ReceiptSize[]

              ).map((size) => {

                const selected =

                  receiptSize === size;



                return (

                  <TouchableOpacity

                    key={size}

                    style={[

                      styles.sizeButton,

                      selected &&

                        styles.sizeButtonSelected,

                    ]}

                    onPress={() =>

                      changeReceiptSize(

                        size

                      )

                    }

                  >

                    <Text

                      style={[

                        styles.sizeButtonText,

                        selected &&

                          styles.sizeButtonTextSelected,

                      ]}

                    >

                      {

                        RECEIPT_CONFIG[

                          size

                        ].label

                      }

                    </Text>



                    <Text

                      style={[

                        styles.sizeButtonDescription,

                        selected &&

                          styles.sizeButtonDescriptionSelected,

                      ]}

                    >

                      {

                        RECEIPT_CONFIG[

                          size

                        ].description

                      }

                    </Text>

                  </TouchableOpacity>

                );

              })}

            </View>



            <Text

              style={

                styles.selectedSizeText

              }

            >

              Selected:{" "}

              {receiptConfig.label}

            </Text>

          </View>

        )}



        {/* PRINTER STATUS */}



        <View style={styles.statusCard}>

          <Text

            style={

              styles.statusLabel

            }

          >

            PRINTER STATUS

          </Text>



          <Text style={styles.status}>

            {status}

          </Text>

        </View>



        {/* DINEFLOW CONNECTION */}



        <View style={styles.statusCard}>

          <Text

            style={

              styles.statusLabel

            }

          >

            DINEFLOW CONNECTION

          </Text>



          <Text

            style={[

              styles.status,

              {

                color: socketConnected

                  ? "#16A34A"

                  : "#DC2626",

              },

            ]}

          >

            {socketConnected

              ? "🟢 Connected to DineFlow"

              : "🔴 Disconnected"}

          </Text>

        </View>



        {/* LAST ORDER */}



        {lastOrder && (

          <View

            style={

              styles.orderCard

            }

          >

            <Text

              style={

                styles.orderTitle

              }

            >

              🧾 New Order Received

            </Text>



            <Text

              style={

                styles.orderNumber

              }

            >

              Order #{lastOrder.orderId}

            </Text>



            <Text

              style={

                styles.orderTable

              }

            >

              Table{" "}

              {lastOrder.tableNumber}

            </Text>



            {lastOrder.items.map(

              (item, index) => (

                <View

                  key={`${item.id}-${index}`}

                  style={

                    styles.orderItem

                  }

                >

                  <Text

                    style={

                      styles.orderItemName

                    }

                  >

                    {item.name}

                  </Text>



                  <Text

                    style={

                      styles.orderQuantity

                    }

                  >

                    × {item.quantity}

                  </Text>

                </View>

              )

            )}



            <View

              style={

                styles.orderTotalRow

              }

            >

              <Text

                style={

                  styles.orderTotalLabel

                }

              >

                Total

              </Text>



              <Text

                style={

                  styles.orderTotal

                }

              >

                ₹{lastOrder.totalPrice}

              </Text>

            </View>

          </View>

        )}



        {/* PRINTERS */}



        <View style={styles.section}>

          <Text

            style={

              styles.sectionTitle

            }

          >

            Paired Printers

          </Text>



          {printers.length === 0 &&

          !loading ? (

            <View

              style={

                styles.emptyCard

              }

            >

              <Text

                style={

                  styles.emptyText

                }

              >

                No paired Bluetooth

                printers found.

              </Text>



              <Text

                style={

                  styles.helpText

                }

              >

                Make sure the SC588 is

                paired with this Android

                phone.

              </Text>

            </View>

          ) : (

            printers.map(

              (printer, index) => {

                const isConnected =

                  connectedPrinter ===

                  printer;



                return (

                  <View

                    key={

                      printer.address ||

                      `${printer.name}-${index}`

                    }

                    style={

                      styles.printerCard

                    }

                  >

                    <View

                      style={

                        styles.printerInfo

                      }

                    >

                      <Text

                        style={

                          styles.printerName

                        }

                      >

                        {printer.name ||

                          "Bluetooth Printer"}

                      </Text>



                      <Text

                        style={

                          styles.address

                        }

                      >

                        {printer.address ||

                          "Address unavailable"}

                      </Text>

                    </View>



                    <TouchableOpacity

                      style={[

                        styles.connectButton,

                        isConnected &&

                          styles.connectedButton,

                      ]}

                      onPress={() =>

                        connectPrinter(

                          printer

                        )

                      }

                      disabled={

                        loading ||

                        isConnected

                      }

                    >

                      <Text

                        style={

                          styles.buttonText

                        }

                      >

                        {isConnected

                          ? "Connected"

                          : "Connect"}

                      </Text>

                    </TouchableOpacity>

                  </View>

                );

              }

            )

          )}

        </View>



        {/* REFRESH */}



        <TouchableOpacity

          style={

            styles.refreshButton

          }

          onPress={

            initializePrinter

          }

          disabled={loading}

        >

          <Text

            style={

              styles.refreshText

            }

          >

            {loading

              ? "Loading..."

              : "Find Printers Again"}

          </Text>

        </TouchableOpacity>



        {/* TEST PRINT */}



        <View

          style={

            styles.testSection

          }

        >

          <Text

            style={

              styles.sectionTitle

            }

          >

            Printer Test

          </Text>



          <TouchableOpacity

            style={[

              styles.printButton,

              (!connectedPrinter ||

                printing) &&

                styles.disabledButton,

            ]}

            onPress={

              printTestReceipt

            }

            disabled={

              !connectedPrinter ||

              printing

            }

          >

            <Text

              style={

                styles.printButtonText

              }

            >

              {printing

                ? "Printing..."

                : "🧾 Print Test Receipt"}

            </Text>

          </TouchableOpacity>

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}



const styles = StyleSheet.create({

  safeArea: {

    flex: 1,

    backgroundColor: "#F6F7F9",

  },



  container: {

    padding: 24,

    paddingBottom: 40,

  },



  logo: {

    fontSize: 14,

    fontWeight: "800",

    color: "#F15A24",

    letterSpacing: 1,

    textTransform: "uppercase",

    marginTop: 20,

  },



  title: {

    fontSize: 30,

    fontWeight: "700",

    color: "#171717",

    marginTop: 4,

  },



  subtitle: {

    fontSize: 16,

    color: "#737373",

    marginTop: 6,

    marginBottom: 20,

  },



  userCard: {

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 18,

    borderWidth: 1,

    borderColor: "#E5E7EB",

    marginBottom: 14,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

  },



  userLabel: {

    fontSize: 11,

    fontWeight: "700",

    color: "#737373",

    letterSpacing: 1,

    marginBottom: 5,

  },



  userName: {

    fontSize: 16,

    fontWeight: "700",

    color: "#171717",

  },



  roleBadge: {

    backgroundColor: "#FFF1EB",

    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 8,

  },



  roleText: {

    fontSize: 11,

    fontWeight: "800",

    color: "#F15A24",

  },



  receiptSettingsCard: {

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 18,

    borderWidth: 1,

    borderColor: "#E5E7EB",

    marginBottom: 14,

  },



  receiptSettingsDescription: {

    fontSize: 14,

    color: "#737373",

    lineHeight: 20,

    marginBottom: 16,

  },



  sizeButtons: {

    gap: 10,

  },



  sizeButton: {

    borderWidth: 1,

    borderColor: "#D4D4D4",

    borderRadius: 12,

    padding: 14,

    backgroundColor: "#FFFFFF",

  },



  sizeButtonSelected: {

    borderColor: "#F15A24",

    backgroundColor: "#FFF7F3",

  },



  sizeButtonText: {

    fontSize: 16,

    fontWeight: "700",

    color: "#171717",

  },



  sizeButtonTextSelected: {

    color: "#F15A24",

  },



  sizeButtonDescription: {

    fontSize: 12,

    color: "#737373",

    marginTop: 4,

  },



  sizeButtonDescriptionSelected: {

    color: "#C2410C",

  },



  selectedSizeText: {

    fontSize: 13,

    fontWeight: "600",

    color: "#525252",

    marginTop: 14,

  },



  statusCard: {

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 20,

    borderWidth: 1,

    borderColor: "#E5E7EB",

    marginBottom: 14,

  },



  statusLabel: {

    fontSize: 12,

    fontWeight: "700",

    color: "#737373",

    letterSpacing: 1,

    marginBottom: 8,

  },



  status: {

    fontSize: 16,

    fontWeight: "600",

    color: "#171717",

  },



  orderCard: {

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 20,

    borderWidth: 1,

    borderColor: "#E5E7EB",

    marginBottom: 24,

  },



  orderTitle: {

    fontSize: 18,

    fontWeight: "700",

    color: "#171717",

    marginBottom: 10,

  },



  orderNumber: {

    fontSize: 15,

    fontWeight: "700",

    color: "#F15A24",

  },



  orderTable: {

    fontSize: 15,

    color: "#525252",

    marginTop: 4,

    marginBottom: 16,

  },



  orderItem: {

    flexDirection: "row",

    justifyContent: "space-between",

    paddingVertical: 7,

    borderBottomWidth: 1,

    borderBottomColor: "#F0F0F0",

  },



  orderItemName: {

    flex: 1,

    fontSize: 15,

    color: "#262626",

  },



  orderQuantity: {

    fontSize: 15,

    fontWeight: "600",

    color: "#525252",

  },



  orderTotalRow: {

    flexDirection: "row",

    justifyContent: "space-between",

    marginTop: 16,

  },



  orderTotalLabel: {

    fontSize: 16,

    fontWeight: "700",

    color: "#171717",

  },



  orderTotal: {

    fontSize: 18,

    fontWeight: "800",

    color: "#171717",

  },



  section: {

    marginBottom: 24,

  },



  sectionTitle: {

    fontSize: 20,

    fontWeight: "700",

    color: "#171717",

    marginBottom: 14,

  },



  emptyCard: {

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 20,

    borderWidth: 1,

    borderColor: "#E5E7EB",

  },



  emptyText: {

    fontSize: 16,

    fontWeight: "600",

    color: "#404040",

  },



  helpText: {

    fontSize: 14,

    color: "#737373",

    marginTop: 8,

    lineHeight: 20,

  },



  printerCard: {

    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 16,

    borderWidth: 1,

    borderColor: "#E5E7EB",

    marginBottom: 12,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

  },



  printerInfo: {

    flex: 1,

    marginRight: 12,

  },



  printerName: {

    fontSize: 17,

    fontWeight: "700",

    color: "#171717",

  },



  address: {

    fontSize: 12,

    color: "#737373",

    marginTop: 4,

  },



  connectButton: {

    backgroundColor: "#171717",

    paddingHorizontal: 16,

    paddingVertical: 10,

    borderRadius: 10,

  },



  connectedButton: {

    backgroundColor: "#16A34A",

  },



  buttonText: {

    color: "#FFFFFF",

    fontSize: 14,

    fontWeight: "700",

  },



  refreshButton: {

    backgroundColor: "#FFFFFF",

    borderWidth: 1,

    borderColor: "#D4D4D4",

    borderRadius: 12,

    paddingVertical: 14,

    alignItems: "center",

    marginBottom: 30,

  },



  refreshText: {

    fontSize: 15,

    fontWeight: "600",

    color: "#171717",

  },



  testSection: {

    marginTop: 4,

  },



  printButton: {

    backgroundColor: "#F15A24",

    borderRadius: 14,

    paddingVertical: 17,

    alignItems: "center",

  },



  disabledButton: {

    backgroundColor: "#A3A3A3",

  },



  printButtonText: {

    color: "#FFFFFF",

    fontSize: 17,

    fontWeight: "700",

  },

});



export default PrinterScreen;