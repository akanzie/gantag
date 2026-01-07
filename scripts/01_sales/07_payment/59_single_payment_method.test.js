import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import { CARD } from "../../../common/constant/card.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function Aoca払い
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.TMN_PREPAID}
 * {@link TAGS.AOCA}
 * {@link TAGS.FULL_AMOUNT}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・Aocaで支払う。
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内でAocaで支払いができる。
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_tmnprepaid
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/tmn-prepaid/value` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 1.Aocaポイント >= 432 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.Aoca: 8090227000000006
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下1つの商品が存在する:
 * * * \+  items.length = 1
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  total_balance_amount =  432
 * * #### 5. 支払登録 `/tmn-prepaid/value`
 * * \- 支払い情報に「Aoca」が存在する
 * * * \+ total_balance_amount: 0
 * * * \+ payments.length = 1
 * * * \+ payments[0]:
 * * * * \.paid_cd= "0927"
 * * * * \.paid_name= "Aoca"
 * * * * \.paid_amount =  432
 * * #### 6. `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「Aoca」
 * * #### 7.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_tmnprepaid
 */
export function TC_010759001_AocaPayment() {
  group("TC_010759001 Aoca払い", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      deposit: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_DEPOSIT),
      tmnPrepaidValue: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_VALUE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const cardNo = CARD.AOKI_PREPAID.CODE;

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product 通常商品",
        expected: (res) => {
          return {
            barcode: PROD.REGULAR,
            itemsLength: 1,
            totalBalanceAmount: Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            itemsLength: res.result?.cartinfo?.items?.length,
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const aocaAmount = totalBalanceAmount;
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    const balance = TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    if (balance < aocaAmount) {
      TestHelper.tmnPrepaidDeposit(step.deposit, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        chargeValueAmount: aocaAmount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    TestHelper.tmnPrepaidValue(step.tmnPrepaidValue, {
      cartNo,
      paidCodes: [
        PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_AOCA_VALUE.PAID_CODE,
      ],
      paidAmount: aocaAmount,
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify only one payment method is Aoca",
        expected: {
          totalBalanceAmount: 0,
          paymentsLength: 1,
          paidCd: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_AOCA_VALUE.PAID_CODE,
          paidName: PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_AOCA_VALUE.PAID_NAME,
          paidAmount: aocaAmount,
        },
        actual: (res) => {
          const aocaPayment = res.result?.cartinfo?.payments?.[0];
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentsLength: res.result?.cartinfo?.payments?.length,
            paidCd: aocaPayment?.paid_cd,
            paidName: aocaPayment?.paid_name,
            paidAmount: aocaPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt contain payment method: Aoca",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_AOCA_VALUE.PAID_NAME),
        ),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_tmnprepaid",
        expected: true,
        actual: (res) => res.result?.paymentTmnprepaids?.length > 0,
      }),
    ]);
  });
}

/**
 * @function ｄポイント払い
 * @memberof ポイント.dポイント
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.POINT}
 * {@link TAGS.SALES}
 * {@link TAGS.D_POINT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.USE}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・ｄポイントで支払う。
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内でｄポイントで支払いができる。
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_common_point
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/dpoint/usepoint` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 1.dPoint >= 432 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.dPoint: 100000006699030
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下1つの商品が存在する:
 * * * \+  items.length = 1
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  total_balance_amount =  432
 * * #### 5. 支払登録 `/dpoint/usepoint`
 * * \- 支払い情報に「dポイント」が存在する
 * * * \+ total_balance_amount: 0
 * * * \+ payments.length = 1
 * * * \+ payments[0]:
 * * * * \.paid_cd= "0501"
 * * * * \.paid_name= "dポイント"
 * * * * \.paid_amount =  432
 * * #### 6. `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「dポイント」
 * * #### 7.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_common_point
 */
export function TC_010759002_DPointPayment() {
  group("TC_010759002 ｄポイント払い", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.DPOINT_USEPOINT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {
      signnedEmployeeCd: "",
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product 通常商品",
        expected: (res) => {
          return {
            barcode: PROD.REGULAR,
            itemsLength: 1,
            totalBalanceAmount: Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            itemsLength: res.result?.cartinfo?.items?.length,
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const dPointUsed = totalBalanceAmount;
    TestHelper.dPointUsePoint(step.payment, {
      cartNo,
      memberId: CARD.DPOINT.CODE,
      pointUseAmount: dPointUsed,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify only one payment method is dポイント",
        expected: {
          totalBalanceAmount: 0,
          paymentsLength: 1,
          paidCd: PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_CODE,
          paidName: PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_NAME,
          paidAmount: dPointUsed,
        },
        actual: (res) => {
          const dPointPayment = res.result?.cartinfo?.payments?.[0];
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentsLength: res.result?.cartinfo?.payments?.length,
            paidCd: dPointPayment?.paid_cd,
            paidName: dPointPayment?.paid_name,
            paidAmount: dPointPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt contain payment method: dポイント",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_common_point",
        expected: true,
        actual: (res) => res.result?.paymentCommonPoints?.length > 0,
      }),
    ]);
  });
}

/**
 * @function クレジットカード
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CREDIT}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・クレジットカードで支払う。
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内でクレジットカードで支払いができる。　　
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_credit
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.クレジットカード 
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下1つの商品が存在する:
 * * * \+  items.length = 1
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  total_balance_amount =  432
 * * #### 5. 支払登録 `/sales/addpayment`
 * * \- 支払い情報に「クレジットカード」が存在する
 * * * \+ total_balance_amount: 0
 * * * \+ payments.length = 1
 * * * \+ payments[0]:
 * * * * \.paid_cd= "0200"
 * * * * \.paid_name= "クレジット"
 * * * * \.paid_amount =  432
 * * #### 6.取引完了 `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「クレジット」
 * * #### 7.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_credit"
 */
export function TC_010759003_CreditCardPayment() {
  group("TC_010759003 クレジットカード", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product 通常商品",
        expected: (res) => {
          return {
            barcode: PROD.REGULAR,
            itemsLength: 1,
            totalBalanceAmount: Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            itemsLength: res.result?.cartinfo?.items?.length,
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const creditAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CREDIT.GROUP_CODE,
      paidCode: PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_CODE,
      totalBalanceAmount: creditAmount,
      details: ENVIRONMENT.CREDIT_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify has only one payment method is クレジットカード",
        expected: {
          totalBalanceAmount: 0,
          paymentsLength: 1,
          paidCd: PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_CODE,
          paidName: PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_NAME,
          paidAmount: creditAmount,
        },
        actual: (res) => {
          const creditPayment = res.result?.cartinfo?.payments?.[0];
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentsLength: res.result?.cartinfo?.payments?.length,
            paidCd: creditPayment?.paid_cd,
            paidName: creditPayment?.paid_name,
            paidAmount: creditPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt contain payment method: クレジット",
        expected: true,
        actual: (res) => res.result?.receipts?.some(r =>
          r.receipt_data.includes(PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_NAME),
        ),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_credit",
        expected: true,
        actual: (res) => res.result?.paymentCredits?.length > 0,
      }),
    ]);
  });
}

/**
 * @function iD
 * @memberof 決済.電子マネー
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.ID}
 * {@link TAGS.SALES}
 * {@link TAGS.FULL_AMOUNT}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・iDで支払う。
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * 1取引内でiDで支払いができる。　　　　　
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_emoney
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.iD
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下1つの商品が存在する:
 * * * \+  items.length = 1
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  total_balance_amount =  432
 * * #### 5. 支払登録 `/sales/addpayment`
 * * \- 支払い情報に「iD」が存在する
 * * * \+ total_balance_amount: 0
 * * * \+ payments.length = 1
 * * * \+ payments[0]:
 * * * * \.paid_cd= "0302"
 * * * * \.paid_name= "iD"
 * * * * \.paid_amount =  432
 * * #### 6.取引完了 `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「iD」
 * * #### 7. 売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms-sales.t_payment
 * * * \+ ms-sales.t_payment_emoney
 */
export function TC_010759004_IDPayment() {
  group("TC_010759004 iD", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product 通常商品",
        expected: (res) => {
          return {
            barcode: PROD.REGULAR,
            itemsLength: 1,
            totalBalanceAmount: Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            itemsLength: res.result?.cartinfo?.items?.length,
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const iDAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.ID.PAID_CODE,
      totalBalanceAmount: iDAmount,
      details: ENVIRONMENT.ID_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify has only one payment method is iD",
        expected: {
          totalBalanceAmount: 0,
          paymentsLength: 1,
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.ID.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.ID.PAID_NAME,
          paidAmount: iDAmount,
        },
        actual: (res) => {
          const iDPayment = res.result?.cartinfo?.payments?.[0];
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentsLength: res.result?.cartinfo?.payments?.length,
            paidCd: iDPayment?.paid_cd,
            paidName: iDPayment?.paid_name,
            paidAmount: iDPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt contain payment method: iD",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.E_MONEY.PAID_ITEMS.ID.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_emoney",
        expected: true,
        actual: (res) => res.result?.paymentEmoneys?.length > 0,
      }),
    ]);
  });
}

/**
 * @function QUICPay
 * @memberof 決済.電子マネー
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.SALES}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.QUICPAY}
 * {@link TAGS.FULL_AMOUNT}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・QUICPayで支払う。
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内でQUICPayで支払いができる。　　　　　　
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_emoney
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.QUICPay
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下1つの商品が存在する:
 * * * \+  items.length = 1
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  total_balance_amount =  432
 * * #### 5. 支払登録 `/sales/addpayment`
 * * \- 支払い情報に「QUICPay」が存在する
 * * * \+ total_balance_amount: 0
 * * * \+ payments.length = 1
 * * * \+ payments[0]:
 * * * * \.paid_cd= "0301"
 * * * * \.paid_name= "QUICPay"
 * * * * \.paid_amount =  432
 * * #### 6.取引完了 `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「QUICPay」
 * * #### 7. 売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms-sales.t_payment
 * * * \+ ms-sales.t_payment_emoney
 */
export function TC_010759005_QUICPayPayment() {
  group("TC_010759005 QUICPay", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product 通常商品",
        expected: (res) => {
          return {
            barcode: PROD.REGULAR,
            itemsLength: 1,
            totalBalanceAmount: Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            itemsLength: res.result?.cartinfo?.items?.length,
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const quicPayAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.QUICPAY.PAID_CODE,
      totalBalanceAmount: quicPayAmount,
      details: ENVIRONMENT.QUICPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify only one payment method is QUICPay",
        expected: {
          totalBalanceAmount: totalBalanceAmount - quicPayAmount,
          paymentsLength: 1,
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.QUICPAY.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.QUICPAY.PAID_NAME,
          paidAmount: quicPayAmount,
        },
        actual: (res) => {
          const quicPayPayment = res.result?.cartinfo?.payments?.[0];
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentsLength: res.result?.cartinfo?.payments?.length,
            paidCd: quicPayPayment?.paid_cd,
            paidName: quicPayPayment?.paid_name,
            paidAmount: quicPayPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt contain payment method: QUICPay",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.E_MONEY.PAID_ITEMS.QUICPAY.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_emoney",
        expected: true,
        actual: (res) => res.result?.paymentEmoneys?.length > 0,
      }),
    ]);
  });
}

/**
 * @function バーコード決済
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CODE_PAYMENT}
 * {@link TAGS.DOMESTIC_BRAND}
 * {@link TAGS.FULL_AMOUNT}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・PayPayで支払う。
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * 1取引内でPayPayで支払いができる。　　　　　　
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_codepayment
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.Paypay
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下1つの商品が存在する:
 * * * \+  items.length = 1
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  total_balance_amount =  432
 * * #### 5. 支払登録 `/sales/addpayment`
 * * \- 支払い情報に「PayPay」が存在する
 * * * \+ total_balance_amount: 0
 * * * \+ payments.length = 1
 * * * \+ payments[0]:
 * * * * \.paid_cd= "0413"
 * * * * \.paid_name= "PayPay"
 * * * * \.paid_amount =  432
 * * #### 6.取引完了 `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「PayPay」
 * * #### 7. 売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms-sales.t_payment
 * * * \+ ms-sales.t_payment_codepayment
 */
export function TC_010759006_PayPayPayment() {
  group("TC_010759006 PayPay", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product 通常商品",
        expected: (res) => {
          return {
            barcode: PROD.REGULAR,
            itemsLength: 1,
            totalBalanceAmount: Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
          };
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            itemsLength: res.result?.cartinfo?.items?.length,
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const payPayAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_CODE,
      totalBalanceAmount: payPayAmount,
      details: ENVIRONMENT.PAYPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify only one payment method is PayPay",
        expected: {
          totalBalanceAmount: 0,
          paymentsLength: 1,
          paidCd: PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_CODE,
          paidName: PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_NAME,
          paidAmount: payPayAmount,
        },
        actual: (res) => {
          const payPayPayment = res.result?.cartinfo?.payments?.[0];
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentsLength: res.result?.cartinfo?.payments?.length,
            paidCd: payPayPayment?.paid_cd,
            paidName: payPayPayment?.paid_name,
            paidAmount: payPayPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt contain payment method: PayPay",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_codepayment",
        expected: true,
        actual: (res) => res.result?.paymentCodepayments?.length > 0,
      }),
    ]);
  });
}
