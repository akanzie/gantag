import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import { PROMOTION } from "../../../common/constant/promotion.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function Aocaポイントのみ
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.POINT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * ### テスト観点
 * * 前提：
 * * ポイント付与_Aocaポイントの売上のレシート返品を行う。
 * * テスト観点：
 * * * ・Aocaポイントが付与された売上取引が返品できる。
 * * * ・売上時に付与されたポイントが減算される。
 * * * ポイント対象商品（対象）とポイント対象商品（上位参照）のAocaポイントが減算される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（対象）スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント付与専用商品（対象外)スキャン`/sales/cart/barcode` | - |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【返品】取引開始 | `/refund/begin` |
 * | 10 | 【返品】小計 | `/refund/subtotal` |
 * | 11 | 【返品】支払登録 | `/refund/addpayment` |
 * | 12 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 売上取引は「ポイント付与_Aocaポイントのみ」に対してレシート返品を実行する
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント対象商品（上位参照）: 4500000000056
 * * 3.ポイント対象商品（対象）: 4520230413001
 * * 4.ポイント付与専用商品（対象外): 4911110703005
 * 
 * ---
 * ### 期待結果
 * * #### 6.小計 `/sales/subtotal`
 * * sales.cartInfoを法事する
 * * #### 10. 【返品】小計   `/refund/subtotal`
 * * カートInfoに以下が正しいか確認:
 * * * \+ total_balance_amount= sale.cartinfo.total_balance_amount
 * * * \+ total_quantity= sale.cartinfo.total_quantity
 * * * \+ customer_cd: "8090227000000006"
 * * * \+ point_card_name:  "Aoca"
 * * * \+ planning_add_points.total_add_point = sales.cartInfo.customer.planning_add_points.total_add_point
 * * #### 12.【返品】取引完了 `/refund/end`
 * * \- レシートデータに　"-25p"の情報があるか確認
 * * (-sales.cartInfo.customer.planning_add_points.total_add_point)　　　　　　　
 */
export function TC_021935001_AocaPoints() {
  group("TC_021935001 Aocaポイントのみ", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      isSelf: false,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodePointTargetReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodePointTarget, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    });

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has correctly refunded the amount and quantity, and Aoca card payment was used",
        expected: () => {
          return {
            totalBalanceAmount: salesCartInfo?.total_balance_amount,
            totalQuantity: salesCartInfo?.total_quantity,
            customerCd: CARD.AOKI_PREPAID.CODE,
            pointCardName: CARD.AOKI_PREPAID.NAME,
            totalAddPoint: salesCartInfo?.customer?.planning_add_points?.total_add_point,
          };
        },
        actual: (res) => {
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            totalQuantity: res.result?.cartinfo?.total_quantity,
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the receipt contains information about the refunded points",
        expected: true,
        actual: (res) => {
          const point = salesCartInfo.customer?.planning_add_points?.total_add_point;
          return res.result?.receipts?.some(r => r.receipt_data.includes(`-${point}p`));
        },
      }),
    ]);
  });
}

/**
 * @function ｄポイントのみ
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.POINT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.D_POINT}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * ### テスト観点
 * * 前提：
 * * ポイント付与_ｄポイントの売上のレシート返品を行う。
 * * テスト観点：
 * * * ・ｄポイントが付与された売上取引が返品できる。
 * * * ・売上時に付与されたポイントが減算される。
 * * * ポイント対象商品（上位参照）とポイント付与専用商品（対象）1のｄポイントがが減算される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | dポイントカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント付与専用商品（対象）スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント付与専用商品（対象外）スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【返品】取引開始 | `/refund/begin` |
 * | 10 | 【返品】小計 | `/refund/subtotal` |
 * | 11 | 【返品】支払登録 | `/refund/addpayment` |
 * | 12 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 売上取引は「ポイント付与_ｄポイント」に対してレシート返品を実行する
 * 
 * ---
 * ### テストデータ
 * * 1.Dpoint: 100000006699030
 * * 2.ポイント対象商品（上位参照）: 4500000000056
 * * 3.ポイント付与専用商品（対象）1: 4520230413021
 * * 4.ポイント付与専用商品（対象外）: 4911110703005
 * 
 * ---
 * ### 期待結果
 * * #### "6.小計 `/sales/subtotal`
 * * sales.cartInfoを法事する
 * * #### 10. 【返品】小計   `/refund/subtotal`
 * * カートInfoに以下が正しいか確認:
 * * * \+ total_balance_amount= sale.cartinfo.total_balance_amount
 * * * \+ total_quantity= sale.cartinfo.total_quantity
 * * * \+ customer_cd: "100000006699030"
 * * * \+ point_card_name:  "dポイントカード"
 * * * \+ planning_add_points.total_add_point = sales.cartInfo.customer.planning_add_points.total_add_point
 * * #### 12.【返品】取引完了 `/refund/end`
 * * \- レシートデータに　"-2p"の情報があるか確認
 * * (-sales.cartInfo.customer.planning_add_points.total_add_point )"
 */
export function TC_021935002_DPoints() {
  group("TC_021935002 ｄポイントのみ", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDPoint: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "dポイントカードスキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      isSelf: false,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDPoint, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.DPOINT.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodePointTargetReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodePointTarget, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has correctly refunded the amount and quantity, and Aoca card payment was used",
        expected: () => {
          return {
            totalBalanceAmount: salesCartInfo?.total_balance_amount,
            totalQuantity: salesCartInfo?.total_quantity,
            customerCd: CARD.DPOINT.CODE,
            pointCardName: CARD.DPOINT.NAME,
            totalAddPoint: salesCartInfo?.customer?.planning_add_points?.total_add_point,
          };
        },
        actual: (res) => {
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            totalQuantity: res.result?.cartinfo?.total_quantity,
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the receipt contains information about the refunded points",
        expected: true,
        actual: (res) => {
          const point = salesCartInfo.customer?.planning_add_points?.total_add_point;
          return res.result?.receipts?.some(r => r.receipt_data.includes(`-${point}p`));
        },
      }),
    ]);
  });
}

/**
 * @function アプリクーポン
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.SALES}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.USE_APP_COUPON}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * * ・アプリクーポンが付与された売上取引が返品できる。
 * * * ・売上時に付与されたポイントが減算される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | アプリクーポン対象商品スキャン | `/sales/cart/barcode` |
 * | 4 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 【返品】取引開始 | `/refund/begin` |
 * | 9 | 【返品】小計 | `/refund/subtotal` |
 * | 10 | 【返品】支払登録 | `/refund/addpayment` |
 * | 11 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_055で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.アプリクーポン対象商品: 0441119400000
 * * 2.通常商品: 4500000000121
 * * 3.プロモー：アプリクーポン 
 * * \- promotion_cd: 10000020308
 * * \- クーポンの設定:
 * * * \+ coupon_cd: 10000020308
 * * * \+ bonus_point: 50
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_055でテスト済み）
 * * #### 5. 小計 `/sales/subtotal`
 * * \- データ取得：sales.cartinfo
 * * #### 6. 支払登録 `/sales/addpayment`
 * * \- データ取得：sales.total_add_point
 * * \- データ取得：aoca_point = sales.point_detail[]（Aoca）
 * * \- データ取得：appcoupon_point = sales.point_detail[]（10000020308）
 * * \- データ取得：sales.payments[]
 * * * 返品データが販売取引と一致していることを確認
 * * #### 9.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引と同じであることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 10.【返品】支払登録 `/refund/addpayment`
 * * \- 返却されたポイント合計が販売取引と一致していることを確認
 * * * \+ planning_add_points.total_add_point = sales.total_add_point
 * * \- 返却されたAocaポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: aoca_point.add_point
 * * * * \. promotion_cd: aoca_point.promotion_cd
 * * * * \. promotion_name: aoca_point.promotion_name
 * * \- 返却されたアプリクーポンポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: appcoupon_point.add_point
 * * * * \. promotion_cd: appcoupon_point.promotion_cd
 * * * * \. promotion_name: appcoupon_point.promotion_name
 * * \- 返金金額が販売取引と同じであることを確認
 * * * \+ void_payments に以下が含まれること：
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返品後の残高合計金額が0であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 11.【返品】取引完了 `/refund/end`
 * * \- 合計ポイントが差し引かれることを確認し、レシートデータに「- sales.total_add_point」が含まれること
 * * \- レシートデータに「ご返金」という情報が含まれ、返金金額が販売取引と一致していることを確認
 */
export function TC_021935006_RefundApplyAppCoupon() {
  group("TC_021935006 アプリクーポン", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeAppCoupon: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "アプリクーポン対象商品スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeAppCoupon, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.APP_COUPON,
          scan_data_type: "JAN13",
        },
      ],
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd == PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
    const totalAddPoint = salesCartInfo?.customer?.planning_add_points?.total_add_point;
    const aocaPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
    const appCouponDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.APP.CD);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: totalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the total points returned matches the sales transaction",
        expected: totalAddPoint,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the Aoca points returned matches the sales transaction",
        expected: {
          addPoint: aocaPointDetail?.add_point,
          promotionCd: aocaPointDetail?.promotion_cd,
          promotionName: aocaPointDetail?.promotion_name,
        },
        actual: (res) => {
          const aocaPointDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          return {
            addPoint: aocaPointDetailRefund?.add_point,
            promotionCd: aocaPointDetailRefund?.promotion_cd,
            promotionName: aocaPointDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the App coupon points returned matches the sales transaction",
        expected: {
          addPoint: appCouponDetail?.add_point,
          promotionCd: appCouponDetail?.promotion_cd,
          promotionName: appCouponDetail?.promotion_name,
        },
        actual: (res) => {
          const appCouponDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.APP.CD);
          return {
            addPoint: appCouponDetailRefund?.add_point,
            promotionCd: appCouponDetailRefund?.promotion_cd,
            promotionName: appCouponDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
	  CHECK.createEqualsCheck({
        name: "Verify total point will be deducted",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          `${-totalAddPoint}p`,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}

/**
 * @function セット買いポイント
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.POINT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.SET}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * * ・セット買いポイントが付与された売上取引が返品できる。
 * * * ・売上時に付与されたポイントが減算される。
 * * * ポイント対象商品（繰り返し無し）のセット買いポイントが減算される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（繰り返し無し）セットスキャン 1回目 | `/sales/cart/barcode` |
 * | - | ※1セット：2個 | - |
 * | 4 | ポイント対象商品（繰り返し無し）1セットスキャン 2回目 | `/sales/cart/barcode` |
 * | - | ※1セット：2個 | - |
 * | 5 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【返品】取引開始 | `/refund/begin` |
 * | 10 | 【返品】小計 | `/refund/subtotal` |
 * | 11 | 【返品】支払登録 | `/refund/addpayment` |
 * | 12 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_051で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント対象商品（繰返し無し）: 4520230413009
 * * 3.通常商品: 4500000000121
 * * 4.promotion_cd = combonorepeat
 * * bonus_point: 60
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_051でテスト済み）
 * * #### 6. 小計 `/sales/subtotal`
 * * \- データ取得：sales.cartinfo
 * * #### 7. 支払登録 `/sales/addpayment`
 * * \- データ取得：sales.total_add_point
 * * \- データ取得：aoca_point = sales.point_detail[]（Aoca）
 * * \- データ取得：combonorepeat_point = sales.point_detail[]（combonorepeat）
 * * \- データ取得：sales.payments[]
 * * * 返品データが販売取引と一致していることを確認
 * * #### 10.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引と同じであることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 11.【返品】支払登録 `/refund/addpayment`
 * * \- 返却されたポイント合計が販売取引と一致していることを確認
 * * * \+ planning_add_points.total_add_point = sales.total_add_point
 * * \- 返却されたAocaポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: aoca_point.add_point
 * * * * \. promotion_cd: aoca_point.promotion_cd
 * * * * \. promotion_name: aoca_point.promotion_name
 * * \- 返却されたコンボ（繰り返しなし）ポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: combonorepeat_point.add_point
 * * * * \. promotion_cd: combonorepeat_point.promotion_cd
 * * * * \. promotion_name: combonorepeat_point.promotion_name
 * * \- 返金金額が販売取引と同じであることを確認
 * * * \+ void_payments に以下が含まれること：
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返品後の残高合計金額が0であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 12.【返品】取引完了 `/refund/end`
 * * \- 合計ポイントが差し引かれることを確認し、レシートデータに「- sales.total_add_point」が含まれること
 * * \- レシートデータに「ご返金」という情報が含まれ、返金金額が販売取引と一致していることを確認
 */
export function TC_021935005_RefundBuyComboNoRepeat() {
  group("TC_021935005 セット買いポイント", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeProdPointTargetNonRepeat1st: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（1セット目の1個目）スキャン"),
      barcodeProdPointTargetNonRepeat2nd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（1セット目の2個目）スキャン"),
      barcodeProdPointTargetNonRepeat3rd: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（2セット目の1個目）スキャン"),
      barcodeProdPointTargetNonRepeat4th: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（繰返し無し）（2セット目の2個目）スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat1st, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat2nd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat3rd, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeProdPointTargetNonRepeat4th, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_NONREPEAT,
          scan_data_type: "JAN13",
        },
      ],
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd == PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
    const totalAddPoint = salesCartInfo?.customer?.planning_add_points?.total_add_point;
    const aocaPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
    const comboNoRepeatDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.COMBO_NO_REPEAT.CD);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: totalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the total points returned matches the sales transaction",
        expected: totalAddPoint,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the Aoca points returned matches the sales transaction",
        expected: {
          addPoint: aocaPointDetail?.add_point,
          promotionCd: aocaPointDetail?.promotion_cd,
          promotionName: aocaPointDetail?.promotion_name,
        },
        actual: (res) => {
          const aocaPointDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          return {
            addPoint: aocaPointDetailRefund?.add_point,
            promotionCd: aocaPointDetailRefund?.promotion_cd,
            promotionName: aocaPointDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the combo no repeat promotion points returned matches the sales transaction",
        expected: {
          addPoint: comboNoRepeatDetail?.add_point,
          promotionCd: comboNoRepeatDetail?.promotion_cd,
          promotionName: comboNoRepeatDetail?.promotion_name,
        },
        actual: (res) => {
          const comboNoRepeatDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.COMBO_NO_REPEAT.CD);
          return {
            addPoint: comboNoRepeatDetailRefund?.add_point,
            promotionCd: comboNoRepeatDetailRefund?.promotion_cd,
            promotionName: comboNoRepeatDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total point will be deducted",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          `${-totalAddPoint}p`,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          // Convert number to string currency
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}

/**
 * @function 商品ブランド属性（ボーナスポイントも同様の動き）
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.POINT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * {@link TAGS.PRODUCT_UNIT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * * ・商品ブランド属性ポイントが付与された売上取引が返品できる。
 * * * ・売上時に付与されたポイントが減算される。
 * * * ブランド属性商品の商品ブランド属性ポイントが減算される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ブランド属性商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【返品】取引開始 | `/refund/begin` |
 * | 8 | 【返品】小計 | `/refund/subtotal` |
 * | 9 | 【返品】支払登録 | `/refund/addpayment` |
 * | 10 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_049で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.ブランド属性商品: 4520230413112
 * * 2.ブランド属性プロモーション :
 * * \- promotion_cd: brand_attribute
 * * \- クーポン設定:
 * * * \+ coupon_cd: brand_attribute
 * * * \+ point_standard_rate : 5
 * * 3.プロモー: 基準ポイント_Aoca: 
 * * * * \+ point_standard_amount: 100
 * * * * \+ add_standard_point: 1
 * * （設定内容: 100円購入ごとに +1ポイント）  
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_049でテスト済み）
 * * #### 4. 小計 `/sales/subtotal`
 * * \- データ取得：sales.cartinfo
 * * #### 5. 支払登録 `/sales/addpayment`
 * * \- データ取得：sales.total_add_point
 * * \- データ取得：aoca_point = sales.point_detail[]（Aoca）
 * * \- データ取得：brand_attribute_point = sales.point_detail[]（brand_attribute）
 * * \- データ取得：sales.payments[]
 * * * 返品データが販売取引と一致していることを確認
 * * #### 8.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引と同じであることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 9.【返品】支払登録 `/refund/addpayment`
 * * \- 返却されたポイント合計が販売取引と一致していることを確認
 * * * \+ planning_add_points.total_add_point = sales.total_add_point
 * * \- 返却されたAocaポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: aoca_point.add_point
 * * * * \. promotion_cd: aoca_point.promotion_cd
 * * * * \. promotion_name: aoca_point.promotion_name
 * * \- 返却されたブランド属性ポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: brand_attribute_point.add_point
 * * * * \. promotion_cd: brand_attribute_point.promotion_cd
 * * * * \. promotion_name: brand_attribute_point.promotion_name
 * * \- 返金金額が販売取引と同じであることを確認
 * * * \+ void_payments に以下が含まれること：
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返品後の残高合計金額が0であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 10.【返品】取引完了 `/refund/end`
 * * \- 合計ポイントが差し引かれることを確認し、レシートデータに「- sales.total_add_point」が含まれること
 * * \- レシートデータに「ご返金」という情報が含まれ、返金金額が販売取引と一致していることを確認
 */
export function TC_021935004_RefundBonusBrand() {
  group("TC_021935004 商品ブランド属性（ボーナスポイントも同様の動き）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeBrandAttributePromo: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ブランド属性商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeBrandAttributePromo, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BRAND_ATTRIBUTE_PROMO,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd == PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
    const totalAddPoint = salesCartInfo?.customer?.planning_add_points?.total_add_point;
    const aocaPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
    const brandAttributeDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.BRAND_ATTRIBUTE.CD);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: totalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the total points returned matches the sales transaction",
        expected: totalAddPoint,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the Aoca points returned matches the sales transaction",
        expected: {
          addPoint: aocaPointDetail?.add_point,
          promotionCd: aocaPointDetail?.promotion_cd,
          promotionName: aocaPointDetail?.promotion_name,
        },
        actual: (res) => {
          const aocaPointDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          return {
            addPoint: aocaPointDetailRefund?.add_point,
            promotionCd: aocaPointDetailRefund?.promotion_cd,
            promotionName: aocaPointDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the brand attribute points returned matches the sales transaction",
        expected: {
          addPoint: brandAttributeDetail?.add_point,
          promotionCd: brandAttributeDetail?.promotion_cd,
          promotionName: brandAttributeDetail?.promotion_name,
        },
        actual: (res) => {
          const brandAttributeDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.BRAND_ATTRIBUTE.CD);
          return {
            addPoint: brandAttributeDetailRefund?.add_point,
            promotionCd: brandAttributeDetailRefund?.promotion_cd,
            promotionName: brandAttributeDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
	  CHECK.createEqualsCheck({
        name: "Verify total point will be deducted",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          `${-totalAddPoint}p`,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          // Convert number to string currency
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}

/**
 * @function ポイント〇倍デー（水/日）
(Points double day (Wednesday/Sunday))
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.POINT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * {@link TAGS.DAY_OF_THE_WEEK}
 * ### テスト観点
 * * テスト観点：
 * * * ・ポイント〇倍デー（水/日）が付与された売上取引が返品できる。
 * * * ・売上時に付与されたポイントが減算される。
 * * * ポイント倍対象商品、ポイント倍対象外商品、通常商品はすべてのポイント〇倍デー（水/日）のポイントが減算される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント倍対象商品スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント倍対象外商品スキャン | `/sales/cart/barcode` |
 * | 5 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【返品】取引開始 | `/refund/begin` |
 * | 10 | 【返品】小計 | `/refund/subtotal` |
 * | 11 | 【返品】支払登録 | `/refund/addpayment` |
 * | 12 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_048で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.ポイント倍対象商品: 4520230413100  
 * * * 対象プロモーション: 購入日にポイント5倍 (5x_point_allday)  
 * * * 設定内容:  
 * * * * ・sunday_promotion_enabled_flg → saturday_promotion_enabled_flg : 1  
 * * 2.ポイント倍対象外商品: 4520230413101  
 * * * 対象プロモーション: 5x_point_noday  
 * * * 設定内容:  
 * * * * ・sunday_promotion_enabled_flg → saturday_promotion_enabled_flg : 0  
 * * * 別プロモーション: 購入日にポイント0倍 (0x_point_allday)  
 * * * 設定内容:  
 * * * * ・sunday_promotion_enabled_flg → saturday_promotion_enabled_flg : 1  
 * * 3.プロモーション: 基準ポイント_Aoca  
 * * * 設定値:  
 * * * * ・point_standard_amount: 100  
 * * * * ・add_standard_point: 1  
 * * * （設定内容: 100円購入ごとに +1ポイント）  
 * * 4.プロモーション: 5x_point_allday  
 * * * 設定値:  
 * * * * ・point_standard_rate: 5  
 * * 5.プロモーション: 0x_point_allday  
 * * * 設定値:  
 * * * * ・point_standard_rate: 0  
 * * 6.通常商品: 4500000000121  
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_048でテスト済み）
 * * #### 6. 小計 `/sales/subtotal`
 * * \- データ取得：sales.cartinfo
 * * #### 7. 支払登録 `/sales/addpayment`
 * * \- データ取得：sales.total_add_point
 * * \- データ取得：aoca_point = sales.point_detail[]（Aoca）
 * * \- データ取得：5x_point = sales.point_detail[]（5x_point_allday）
 * * \- データ取得：sales.payments[]
 * * * 返品データが販売取引と一致していることを確認
 * * #### 10.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引と同じであることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 11.【返品】支払登録 `/refund/addpayment`
 * * \- 返却されたポイント合計が販売取引と一致していることを確認
 * * * \+ planning_add_points.total_add_point = sales.total_add_point
 * * \- 返却されたAocaポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: aoca_point.add_point
 * * * * \. promotion_cd: aoca_point.promotion_cd
 * * * * \. promotion_name: aoca_point.promotion_name
 * * \- 返却された5x_pointポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: 5x_point.add_point
 * * * * \. promotion_cd: 5x_point.promotion_cd
 * * * * \. promotion_name: 5x_point.promotion_name
 * * \- 返金金額が販売取引と同じであることを確認
 * * * \+ void_payments に以下が含まれること：
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返品後の残高合計金額が0であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 12.【返品】取引完了 `/refund/end`
 * * \- 合計ポイントが差し引かれることを確認し、レシートデータに「- sales.total_add_point」が含まれること
 * * \- レシートデータに「ご返金」という情報が含まれ、返金金額が販売取引と一致していることを確認
 */
export function TC_021935003_RefundBonusPointsDay() {
  group("TC_021935003 ポイント〇倍デー（水/日）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント倍対象商品スキャン"),
      barcodeUnMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント倍対象外商品スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodeMultiplyPoints, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MULTIPLY_POINTS,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeUnMultiplyPoints, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.UN_MULTIPLY_POINTS,
          scan_data_type: "JAN13",
        },
      ],
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd == PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
    const totalAddPoint = salesCartInfo?.customer?.planning_add_points?.total_add_point;
    const aocaPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
    const point5xPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.POINT_5X_ALLDAY.CD);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: totalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the total points returned matches the sales transaction",
        expected: totalAddPoint,
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the Aoca points returned matches the sales transaction",
        expected: {
          addPoint: aocaPointDetail?.add_point,
          promotionCd: aocaPointDetail?.promotion_cd,
          promotionName: aocaPointDetail?.promotion_name,
        },
        actual: (res) => {
          const aocaPointDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          return {
            addPoint: aocaPointDetailRefund?.add_point,
            promotionCd: aocaPointDetailRefund?.promotion_cd,
            promotionName: aocaPointDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the multiplicate points returned matches the sales transaction",
        expected: {
          addPoint: point5xPointDetail?.add_point,
          promotionCd: point5xPointDetail?.promotion_cd,
          promotionName: point5xPointDetail?.promotion_name,
        },
        actual: (res) => {
          const point5xPointDetailRefund = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.POINT_5X_ALLDAY.CD);
          return {
            addPoint: point5xPointDetailRefund?.add_point,
            promotionCd: point5xPointDetailRefund?.promotion_cd,
            promotionName: point5xPointDetailRefund?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total point will be deducted",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          `${-totalAddPoint}p`,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          // Convert number to string currency
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
