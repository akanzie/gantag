import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function WAONと現金
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.COMBINED_USE}
 * {@link TAGS.WAON}
 * {@link TAGS.CASH}
 * {@link TAGS.COMBINED_USE_OF_CASH_INSUFFICIENT_BALANCE}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・支払併用パターンがm_concomitant_payment_patternに設定されている。・商品を購入する
 * * * * →　商品A～B：どの商品でも可。
 * * * ・以下の方法で支払う。
 * * * * →　WAONで支払を行うが残高不足となる。
 * * * * →　不足分を現金で支払う
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内でWAONで支払を行い残高不足分を現金で支払いができる。　
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_emoney
 * * \- t_payment_cash
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 (WAON) | `/sales/addpayment` |
 * | 6 | 支払登録 (Cash) | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 1. WAON支払を100円に設定し、残額を現金で支払う
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. NONPLU商品: 0445000701007
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に2商品が登録されていることを確認
 * * * \+ 通常商品 barcode: 4500000000121
 * * * \+ NONPLU商品 barcode: 0445000700000
 * * * \+ total_balance_amount = 540
 * * #### 5. `/sales/addpayment` (WAON)
 * * * \+ total_balance_amount: 440
 * * * \+ WAON支払情報：
 * * * * \.paid_cd= "0307"
 * * * * \.paid_name= "WAON"
 * * * * \.paid_amount = 100
 * * #### 6. `/sales/addpayment` (現金)
 * * * \+ total_balance_amount: 0
 * * * \+ 現金支払情報：
 * * * * \.paid_cd= "0102"
 * * * * \.paid_name= "現金"
 * * * * \.paid_amount = 440
 * * #### 7. `/sales/end`
 * * \- レシートにデータXMLが含まれていることを確認
 * * \- レシートが正しく印字され、2つの支払方法（WAONと現金）が記載されていることを確認
 * * #### 8.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_emoney
 * * * \+ ms_sales.t_payment_cash
 */
export function TC_010748001_PayWithWaonAndCash() {
  group("TC_010748001 WAONと現金", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      paymentWaon: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (WAON)"),
      paymentCash: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (現金)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const waonAmount = 100; //test data (Amount less than total sales amount)
    let totalBalanceAmount = 0;

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.通常商品スキャン /sales/cart/barcode
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

    // 3.NONPLU商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeNonPlu, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 4.小計 /sales/subtotal
    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 scanned items: 通常商品, NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 (WAON) /sales/addpayment
    totalBalanceAmount = TestHelper.salesAddPayment(step.paymentWaon, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
      totalBalanceAmount: waonAmount,
      details: ENVIRONMENT.WAON_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after WAON payment",
        expected: totalBalanceAmount - waonAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify WAON payment has been applied",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_NAME,
          paidAmount: waonAmount,
        },
        actual: (res) => {
          const waonPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);
          return {
            paidCd: waonPayment?.paid_cd,
            paidName: waonPayment?.paid_name,
            paidAmount: waonPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 (Cash) /sales/addpayment
    const cashAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.paymentCash, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: cashAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Cash payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Cash payment has been applied",
        expected: {
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
          paidAmount: cashAmount,
        },
        actual: (res) => {
          const cashPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
          return {
            paidCd: cashPayment?.paid_cd,
            paidName: cashPayment?.paid_name,
            paidAmount: cashPayment?.paid_amount,
          };
        },
      }),
    ]);

    // 7.取引完了 /sales/end
    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 payment methods",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_NAME,
          PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    // 8.売上ジャーナルトラン SalesData/tran/getdata
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
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_cash",
        expected: true,
        actual: (res) => res.result?.paymentCashes?.length > 0,
      }),
    ]);
  });
}

/**
 * @function 交通系ICと現金
(Transportation IC and cash)
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.COMBINED_USE}
 * {@link TAGS.CASH}
 * {@link TAGS.TRANSPORTATION_IC}
 * {@link TAGS.COMBINED_USE_OF_CASH_INSUFFICIENT_BALANCE}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・支払併用パターンがm_concomitant_payment_patternに設定されている。
 * * * ・以下の方法で支払う。
 * * * * →　交通系ICで支払を行うが残高不足となる。
 * * * * →　不足分を現金で支払う
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内で交通系ICで支払を行い残高不足分を現金で支払いができる。
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_emoney
 * * \- t_payment_cash
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 (交通系IC) | `/sales/addpayment` |
 * | 6 | 支払登録 (Cash) | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 1.交通系IC支払を100円に設定し、残額を現金で支払う
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. NONPLU商品: 0445000701007
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に2商品が登録されていることを確認
 * * * \+ 通常商品 barcode: 4500000000121
 * * * \+ NONPLU商品 barcode: 0445000700000
 * * * \+ total_balance_amount = 540
 * * #### 5. `/sales/addpayment` (交通系IC)
 * * * \+ total_balance_amount: 440
 * * * \+ 交通系IC payment contains:
 * * * * \.paid_cd= "0303"
 * * * * \.paid_name= "交通系IC"
 * * * * \.paid_amount =  100
 * * #### 6. `/sales/addpayment` (現金)
 * * * \+ total_balance_amount: 0
 * * * \+ 現金 payment contains:
 * * * * \.paid_cd= "0102"
 * * * * \.paid_name= "現金"
 * * * * \.paid_amount =  440
 * * #### 7. `/sales/end`
 * * \- レシートにデータXMLが含まれていることを確認
 * * \- レシートが正しく印字され、2つの支払方法（通交通系ICと現金）が記載されていることを確認
 * * #### 8.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_emoney
 * * * \+ ms_sales.t_payment_cash
 */
export function TC_010748002_PayWithTransportationICAndCash() {
  group("TC_010748002 交通系ICと現金", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      paymentIC: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (交通系IC)"),
      paymentCash: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (現金)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const icAmount = 100; //test data (Amount less than total sales amount)
    let totalBalanceAmount = 0;

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.通常商品スキャン /sales/cart/barcode
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

    // 3.NONPLU商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeNonPlu, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 4.小計 /sales/subtotal
    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 scanned items: 通常商品, NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 (交通系IC) /sales/addpayment
    totalBalanceAmount = TestHelper.salesAddPayment(step.paymentIC, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_CODE,
      totalBalanceAmount: icAmount,
      details: ENVIRONMENT.KOUTSU_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Transportation IC payment",
        expected: totalBalanceAmount - icAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Transportation IC payment has been applied",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_NAME,
          paidAmount: icAmount,
        },
        actual: (res) => {
          const icPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_CODE);
          return {
            paidCd: icPayment?.paid_cd,
            paidName: icPayment?.paid_name,
            paidAmount: icPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 (Cash) /sales/addpayment
    const cashAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.paymentCash, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: cashAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Cash payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Cash payment has been applied",
        expected: {
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
          paidAmount: cashAmount,
        },
        actual: (res) => {
          const cashPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
          return {
            paidCd: cashPayment?.paid_cd,
            paidName: cashPayment?.paid_name,
            paidAmount: cashPayment?.paid_amount,
          };
        },
      }),
    ]);

    // 7.取引完了 /sales/end
    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 payment methods",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_NAME,
          PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    // 8.売上ジャーナルトラン SalesData/tran/getdata
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
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_cash",
        expected: true,
        actual: (res) => res.result?.paymentCashes?.length > 0,
      }),
    ]);
  });
}

/**
 * @function nanacoと現金
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.COMBINED_USE}
 * {@link TAGS.CASH}
 * {@link TAGS.NANACO}
 * {@link TAGS.COMBINED_USE_OF_CASH_INSUFFICIENT_BALANCE}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・支払併用パターンがm_concomitant_payment_patternに設定されている。
 * * * ・以下の方法で支払う。
 * * * * →　nanacoで支払を行うが残高不足となる。
 * * * * →　不足分を現金で支払う
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内でnanacoで支払を行い残高不足分を現金で支払いができる。
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_emoney
 * * \- t_payment_cash
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 (nanaco) | `/sales/addpayment` |
 * | 6 | 支払登録 (Cash) | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. NONPLU商品: 0445000701007
 * * 3. nanaco
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下2つの商品が存在する:
 * * * \+ items.length = 2
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  NONPLU商品 barcode: 0445000700000
 * * * \+  total_balance_amount =  540
 * * #### 5.支払登録 `/sales/addpayment` (nanaco)
 * * \- 支払い情報に「nanaco」が存在する
 * * * \+ total_balance_amount: 440
 * * * \+ payment contains:
 * * * * \.paid_cd= "0308"
 * * * * \.paid_name= "nanaco"
 * * * * \.paid_amount =  100
 * * #### 6.支払登録 `/sales/addpayment` (cash)
 * * \- 支払い情報に「現金」が存在する
 * * * \+ total_balance_amount: 0
 * * * \+ payment contains:
 * * * * \.paid_cd= "0102"
 * * * * \.paid_name= "現金"
 * * * * \.paid_amount =  440
 * * #### 7. 取引完了 `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「nanaco」と「現金」
 * * #### 8.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_emoney
 * * * \+ ms_sales.t_payment_cash
 */
export function TC_010748004_PayWithNanacoAndCash() {
  group("TC_010748004 nanacoと現金", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      paymentNanaco: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (nanaco)"),
      paymentCash: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (現金)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const nanacoAmount = 100; //test data (Amount less than total sales amount)
    let totalBalanceAmount = 0;

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

    TestHelper.salesCartBarcode(step.barcodeNonPlu, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 scanned items: 通常商品, NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    totalBalanceAmount = TestHelper.salesAddPayment(step.paymentNanaco, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.NANACO.PAID_CODE,
      totalBalanceAmount: nanacoAmount,
      details: ENVIRONMENT.NANACO_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after nanaco payment",
        expected: totalBalanceAmount - nanacoAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify nanaco payment has been applied",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.NANACO.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.NANACO.PAID_NAME,
          paidAmount: nanacoAmount,
        },
        actual: (res) => {
          const nanacoPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.NANACO.PAID_CODE);
          return {
            paidCd: nanacoPayment?.paid_cd,
            paidName: nanacoPayment?.paid_name,
            paidAmount: nanacoPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const cashAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.paymentCash, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: cashAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Cash payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Cash payment has been applied",
        expected: {
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
          paidAmount: cashAmount,
        },
        actual: (res) => {
          const cashPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
          return {
            paidCd: cashPayment?.paid_cd,
            paidName: cashPayment?.paid_name,
            paidAmount: cashPayment?.paid_amount,
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
        name: "Receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 payment methods: nanaco and cash",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.E_MONEY.PAID_ITEMS.NANACO.PAID_NAME,
          PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    // 8.売上ジャーナルトラン SalesData/tran/getdata
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
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_cash",
        expected: true,
        actual: (res) => res.result?.paymentCashes?.length > 0,
      }),
    ]);
  });
}

/**
 * @function 楽天Edyと現金
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.COMBINED_USE}
 * {@link TAGS.CASH}
 * {@link TAGS.RAKUTEN_EDY}
 * {@link TAGS.COMBINED_USE_OF_CASH_INSUFFICIENT_BALANCE}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・支払併用パターンがm_concomitant_payment_patternに設定されている。
 * * * ・以下の方法で支払う。
 * * * * →　楽天Edyで支払を行うが残高不足となる。
 * * * * →　不足分を現金で支払う
 * * * ・m_unavailable_payment_patternに商品分類パターンコード　と　支払制御パターンコードのレコードがない商品と支払を利用する。
 * * テスト観点：
 * * * ・1取引内で楽天Edyで支払を行い残高不足分を現金で支払いができる。
 * * * ・トランの確認
 * * \- t_payment
 * * \- t_payment_emoney
 * * \- t_payment_cash
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 (楽天Edy) | `/sales/addpayment` |
 * | 6 | 支払登録 (Cash) | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. NONPLU商品: 0445000701007
 * * 3. 楽天Edyカード
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * カート情報に以下2つの商品が存在する:
 * * * \+ 通常商品 barcode:  4500000000121
 * * * \+  NONPLU商品 barcode: 0445000700000
 * * \-> Total price = items[0].unit_price + items[1].unit_price = 400 + 100 = 500
 * * \-> Total tax = items[0].unit_price x (items[0].tax_rate`/100`) + items[1].unit_price x (items[1].tax_rate`/100`) = 400 x 8% + 100 x 8% = 40
 * * * \+ total_balance_amount = Total price + Total tax = 500 + 40 = 540
 * * #### 5. `/sales/addpayment` (楽天Edy)
 * * \- 支払い情報に「楽天Edy」が存在する
 * * * \+ total_balance_amount = total_balance_amount (in step 4) - paid_amount (楽天Edy) = 540 - 100 = 440
 * * * \+ 楽天Edy payment contains:
 * * * * \.paid_cd= "0306"
 * * * * \.paid_name= "楽天Edy"
 * * * * \.paid_amount =  100
 * * #### 6. `/sales/addpayment` (cash)
 * * \- 支払い情報に「現金」が存在する
 * * * \+ total_balance_amount = total_balance_amount (in step 5) - paid_amount (現金) = 440 - 440 = 0
 * * * \+ 現金 payment contains:
 * * * * \.paid_cd= "0102"
 * * * * \.paid_name= "現金"
 * * * * \.paid_amount =  440
 * * #### 7. `/sales/end`
 * * \- レシートが出力され, 以下の支払い情報が存在する:
 * * * 「楽天Edy」と「現金」
 * * #### 8.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 以下のテーブルにデータが登録されること:
 * * * \+ ms_sales.t_payment
 * * * \+ ms_sales.t_payment_emoney
 * * * \+ ms_sales.t_payment_cash
 */
export function TC_010748003_PayWithRakutenEdyAndCash() {
  group("TC_010748003 楽天Edyと現金", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      paymentEdy: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (楽天Edy)"),
      paymentCash: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (現金)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const edyAmount = 100; //test data (Amount less than total sales amount)
    let totalBalanceAmount = 0;

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

    TestHelper.salesCartBarcode(step.barcodeNonPlu, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 scanned items: 通常商品, NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    totalBalanceAmount = TestHelper.salesAddPayment(step.paymentEdy, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.EDY.PAID_CODE,
      totalBalanceAmount: edyAmount,
      details: ENVIRONMENT.EDY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Rakuten Edy payment",
        expected: totalBalanceAmount - edyAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Rakuten Edy payment has been applied",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.EDY.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.EDY.PAID_NAME,
          paidAmount: edyAmount,
        },
        actual: (res) => {
          const edyPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.EDY.PAID_CODE);
          return {
            paidCd: edyPayment?.paid_cd,
            paidName: edyPayment?.paid_name,
            paidAmount: edyPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const cashAmount = totalBalanceAmount;
    TestHelper.salesAddPayment(step.paymentCash, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: cashAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount after Cash payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify Cash payment has been applied",
        expected: {
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
          paidAmount: cashAmount,
        },
        actual: (res) => {
          const cashPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
          return {
            paidCd: cashPayment?.paid_cd,
            paidName: cashPayment?.paid_name,
            paidAmount: cashPayment?.paid_amount,
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
        name: "Receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 payment methods",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.E_MONEY.PAID_ITEMS.EDY.PAID_NAME,
          PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndResponse?.result?.receipt_no;
    const businessDay = salesEndResponse?.result?.business_day;

    // 8.売上ジャーナルトラン SalesData/tran/getdata
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
      CHECK.createEqualsCheck({
        name: "Verify data has been saved to t_payment_cash",
        expected: true,
        actual: (res) => res.result?.paymentCashes?.length > 0,
      }),
    ]);
  });
}
