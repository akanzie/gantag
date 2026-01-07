import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 商品スキャン前
 * @memberof 売上.取引中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.ELECTRONIC_JOURNAL_SEARCH}
 * {@link TAGS.TRANSACTION_SUSPENSION}
 * {@link TAGS.MANUAL_ABORT}
 * ### テスト観点
 * * 前提：
 * * 取引開始後、商品スキャン前に取引中止を行う。
 * * テスト観点：
 * * 取引が中止され、カートに下記のトラン出力情報が格納されている。
 * * * ・電子ジャーナルトラン
 * * * ・電子ジャーナル_売上トラン
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 取引中止ボタン押下 | `/sales/abort` |
 * | 3 | 電子ジャーナルトラン | `PosReceiptData`/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 特になし
 * 
 * ---
 * ### 期待結果
 * * #### 3. 電子ジャーナルトラン PosReceiptData`/tran/getdata`
 * * \- 以下のトランデータを確認:
 * * * \+ 電子ジャーナルトラン
 * * * \+ 電子ジャーナル_売上トラン constains:
 * * * * \. suspensionTransactionFlg = true (取引中止済)
 */
export function TC_011730001_AbortBeforeProductScan() {
  group("TC_011730001 商品スキャン前", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      salesAbort: CommonFunction.getFullDesc(ENDPOINT.SALES_ABORT),
      getPostReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
    };

    // Test data
    const operateEmployeeCd = ENVIRONMENT.EMPLOYEE_BARCODE;

    const cartNo = TestHelper.salesBegin(step.salesBegin, {
      operateEmployeeCd,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesAbortResponse = TestHelper.salesAbort(step.salesAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const receiptNo = salesAbortResponse.result?.receipt_no;
    const businessDay = salesAbortResponse.result?.business_day;

    TestHelper.getPosReceiptData(step.getPostReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify response data has ejournals and ejournalSales",
        expected: {
          ejournalsData: true,
          ejournalSalesData: true,
        },
        actual: (res) => {
          return {
            ejournalsData: res?.result?.ejournals?.length > 0,
            ejournalSalesData: res?.result?.ejournalSales?.length > 0,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify ejournalSales constains transaction suspended",
        expected: true,
        actual: res => res?.result?.ejournalSales?.[0]?.suspensionTransactionFlg,
      })
    ]);
  });
}

/**
 * @function 商品スキャン後
 * @memberof 売上.取引中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.ELECTRONIC_JOURNAL_SEARCH}
 * {@link TAGS.TRANSACTION_SUSPENSION}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.MANUAL_ABORT}
 * {@link TAGS.CODE_INPUT}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * 前提：
 * * 商品スキャン後に取引中止を行う。
 * * テスト観点：
 * * 取引が中止され、カートに下記のトラン出力情報が格納されている。
 * * * ・電子ジャーナルトラン
 * * * ・電子ジャーナル_売上トラン
 * * * ・電子ジャーナル_売上_商品明細トラン
 * * * ・売上トラン
 * * * ・売上_商品明細トラン
 * * * ・売上_税トラン
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 取引中止ボタン押下 | `/sales/abort` |
 * | 4 | 電子ジャーナルトラン | `PosReceiptData/tran/getdata` |
 * | 5 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品 : 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 4. 電子ジャーナルトラン PosReceiptData`/tran/getdata`
 * * \- 以下のトランデータを確認:
 * * * \+ 電子ジャーナルトラン
 * * * \+ 電子ジャーナル_売上トラン constains:
 * * * * \. suspensionTransactionFlg = true (取引中止済)
 * * * \+ 電子ジャーナル_売上_商品明細トラン  constains:
 * * * * \. information of 通常商品 barcode
 * * #### 5. 売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のトランデータを確認:
 * * * \+ 売上トラン constains:
 * * * * \. suspensionTransactionFlg = true (取引中止済)
 * * * \+ 売上_商品明細トラン constains:
 * * * * \. information of 通常商品 barcode
 * * * \+ 売上_税トラン
 */
export function TC_011730002_AbortAfterProductScan() {
  group("TC_011730002 商品スキャン後", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品"),
      salesAbort: CommonFunction.getFullDesc(ENDPOINT.SALES_ABORT),
      getPostReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
    };

    // Test data
    const operateEmployeeCd = ENVIRONMENT.EMPLOYEE_BARCODE;

    const cartNo = TestHelper.salesBegin(step.salesBegin, {
      operateEmployeeCd,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesAbortResponse = TestHelper.salesAbort(step.salesAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const receiptNo = salesAbortResponse.result?.receipt_no;
    const businessDay = salesAbortResponse.result?.business_day;

    // 電子ジャーナルトラン PosReceiptData/tran/getdata
    TestHelper.getPosReceiptData(step.getPostReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify response data has ejournals, ejournalSales and ejournalSalesDetailItems",
        expected: {
          ejournalsData: true,
          ejournalSalesData: true,
          ejournalSalesDetailItemsData: true,
        },
        actual: (res) => {
          return {
            ejournalsData: res?.result?.ejournals?.length > 0,
            ejournalSalesData: res?.result?.ejournalSales?.length > 0,
            ejournalSalesDetailItemsData: res?.result?.ejournalSalesDetailItems?.length > 0,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify ejournalSales constains transaction suspended",
        expected: true,
        actual: res => res?.result?.ejournalSales?.[0]?.suspensionTransactionFlg,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ejournalSalesDetailItems constains information of 通常商品 barcode",
        expected: PROD.REGULAR,
        actual: res => res?.result?.ejournalSalesDetailItems?.[0]?.barcode1,
      }),
    ]);

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify response data has sales, salesDetailItems and salesDetailTaxes",
        expected: {
          salesData: true,
          salesDetailItemsData: true,
          salesDetailTaxesData: true,
        },
        actual: (res) => {
          return {
            salesData: res?.result?.sales?.length > 0,
            salesDetailItemsData: res?.result?.salesDetailItems?.length > 0,
            salesDetailTaxesData: res?.result?.salesDetailTaxes?.length > 0,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify sales constains transaction suspended",
        expected: true,
        actual: res => res?.result?.sales?.[0]?.suspensionTransactionFlg,
      }),
      CHECK.createEqualsCheck({
        name: "Verify salesDetailItems constains information of 通常商品 barcode",
        expected: PROD.REGULAR,
        actual: res => res?.result?.salesDetailItems?.[0]?.barcode1,
      }),
    ]);
  });
}

/**
 * @function 支払方法選択画面遷移後
 * @memberof 売上.取引中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.ELECTRONIC_JOURNAL_SEARCH}
 * {@link TAGS.TRANSACTION_SUSPENSION}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.MANUAL_ABORT}
 * {@link TAGS.CODE_INPUT}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * 前提：
 * * 支払方法を選択後に取引中止を行う。
 * * 取引が中止され、カートに下記のトラン出力情報が格納されている。
 * * * ・電子ジャーナルトラン
 * * * ・電子ジャーナル_売上トラン
 * * * ・電子ジャーナル_売上_商品明細トラン
 * * * ・売上トラン
 * * * ・売上_商品明細トラン
 * * * ・売上_税トラン
 * * * ・支払いトラン
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 (Linepay) | `/sales/addpayment` |
 * | 5 | 取引中止ボタン押下 | `/sales/abort` |
 * | 6 | 電子ジャーナルトラン | `PosReceiptData/tran/getdata` |
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品 : 4500000000121
 * * 2. 支払方法： LINEPay
 * 
 * ---
 * ### 期待結果
 * * #### 6. 電子ジャーナルトラン PosReceiptData`/tran/getdata`
 * * \- 以下のトランデータを確認:
 * * * \+ 電子ジャーナルトラン
 * * * \+ 電子ジャーナル_売上トラン constains:
 * * * * \. suspensionTransactionFlg = true (取引中止済)
 * * * \+ 電子ジャーナル_売上_商品明細トラン  constains:
 * * * * \. information of 通常商品 barcode
 * * #### 7. 売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のトランデータを確認:
 * * * \+ 売上トラン constains:
 * * * * \. suspensionTransactionFlg = true (取引中止済)
 * * * \+ 売上_商品明細トラン constains:
 * * * * \. information of 通常商品 barcode
 * * * \+ 売上_税トラン
 * * * \+ 支払いトラン constains:
 * * * * \. information of payment method: payment_cd = "0412", payment_name = "LINEPay"
 * * * * \. information of 通常商品 paid amount = 売上_税トラン.taxable_amount + (売上_税トラン.taxable_amount x 売上_税トラン.tax_rate / 100) = 400 + 400 x 8% = 432
 */
export function TC_011730003_AbortAfterAddPayment() {
  group("TC_011730003 支払方法選択画面遷移後", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesAddPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      salesAbort: CommonFunction.getFullDesc(ENDPOINT.SALES_ABORT),
      getPostReceiptData: CommonFunction.getFullDesc(ENDPOINT.POS_RECEIPT_DATA_TRAN_GET_DATA),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA),
    };

    // Test data
    const operateEmployeeCd = ENVIRONMENT.EMPLOYEE_BARCODE;

    const cartNo = TestHelper.salesBegin(step.salesBegin, {
      operateEmployeeCd,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.salesSubtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    });

    const salesAbortResponse = TestHelper.salesAbort(step.salesAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const receiptNo = salesAbortResponse.result?.receipt_no;
    const businessDay = salesAbortResponse.result?.business_day;

    TestHelper.getPosReceiptData(step.getPostReceiptData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify response data has ejournals, ejournalSales and ejournalSalesDetailItems",
        expected: {
          ejournalsData: true,
          ejournalSalesData: true,
          ejournalSalesDetailItemsData: true,
        },
        actual: (res) => {
          return {
            ejournalsData: res?.result?.ejournals?.length > 0,
            ejournalSalesData: res?.result?.ejournalSales?.length > 0,
            ejournalSalesDetailItemsData: res?.result?.ejournalSalesDetailItems?.length > 0,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify ejournalSales constains transaction suspended",
        expected: true,
        actual: res => res?.result?.ejournalSales?.[0]?.suspensionTransactionFlg,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ejournalSalesDetailItems constains information of 通常商品 barcode",
        expected: PROD.REGULAR,
        actual: res => res?.result?.ejournalSalesDetailItems?.[0]?.barcode1,
      }),
    ]);

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify response data has sales, salesDetailItems, salesDetailTaxes and Payments",
        expected: {
          salesData: true,
          salesDetailItemsData: true,
          salesDetailTaxesData: true,
          paymentsData: true,
        },
        actual: (res) => {
          return {
            salesData: res?.result?.salesDetailTaxes?.length > 0,
            salesDetailItemsData: res?.result?.salesDetailItems?.length > 0,
            salesDetailTaxesData: res?.result?.salesDetailTaxes?.length > 0,
            paymentsData: res?.result?.payments?.length > 0,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify sales constains transaction suspended",
        expected: true,
        actual: res => res?.result?.sales?.[0]?.suspensionTransactionFlg,
      }),
      CHECK.createEqualsCheck({
        name: "Verify salesDetailItems constains information of 通常商品 barcode",
        expected: PROD.REGULAR,
        actual: res => res?.result?.salesDetailItems?.[0]?.barcode1,
      }),
      CHECK.createEqualsCheck({
        name: "Verify payments information is correct",
        expected: (res) => {
          const salesDetailTaxes = res?.result?.salesDetailTaxes;
          return {
            paymentCd: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
            paymentName: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_NAME,
            paidAmount: salesDetailTaxes?.[0]?.taxableAmount + salesDetailTaxes?.[0]?.taxableAmount * salesDetailTaxes?.[0]?.taxRate / 100,
          };
        },
        actual: (res) => {
          return {
            paymentCd: res?.result?.payments?.[0]?.paymentCd,
            paymentName: res?.result?.payments?.[0]?.paymentName,
            paidAmount: res?.result?.payments?.[0]?.paidAmount,
          };
        },
      }),
    ]);
  });
}
