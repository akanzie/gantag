import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { PROMOTION } from "../../../common/constant/promotion.js";
import { CARD } from "../../../common/constant/card.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 現金売上かつAocaポイント付与の誤打訂正
 * @memberof 誤打訂正.売上業務
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.POINT}
 * {@link TAGS.SALES_OPERATIONS}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * {@link TAGS.CASH}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * * ・現金払で支払った売上取引が誤打訂正により取消ができる。
 * * * ・付与されたAocaポイントが取り消される。
 * *    ポイント対象商品（上位参照）とポイント対象商品（対象）のポイントが取り消される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | Aok カードのポイントを0にセット | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（対象）スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント付与専用商品（対象外）スキャン | - |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 10 | 【誤打訂正】支払登録 | `/void/addpayment` |
 * | 11 | 【誤打訂正】取引終了 | `/void/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_046で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006
 * * 2.ポイント対象商品（上位参照）: 4500000000056
 * * 3. ポイント対象商品（対象）: 4520230413001
 * * 4. ポイント付与専用商品（対象外): 4911110703005
 * * 5. プロモーの 基準ポイント_Aoca: 
 * * * * \+ point_standard_amount: 100
 * * * * \+ add_standard_point: 1
 * * （設定内容: 100円購入ごとに +1ポイント）  
 * 
 * ---
 * ### 期待結果
 * *  * データ取得（販売取引 TC_046でテスト済み）
 * * #### 6. 小計 `/sales/subtotal`
 * * \- データ取得：sales.cartinfo
 * * #### 7. 支払登録 `/sales/addpayment`
 * * \- データ取得：sales.total_add_point
 * * \- データ取得：aoca_point = sales.point_detail[]（Aoca）
 * * \- データ取得：sales.payments[]
 * *  * 誤打訂正データが販売取引と一致していることを確認
 * * #### 9.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引と同じであることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 10.【誤打訂正】支払登録 `/void/addpayment`
 * * \- 返却されたポイント合計が販売取引と一致していることを確認
 * * * \+ planning_add_points.total_add_point = sales.total_add_point
 * * \- 返却されたAocaポイントが販売取引と一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること：
 * * * * \. add_point: aoca_point.add_point
 * * * * \. promotion_cd: aoca_point.promotion_cd
 * * * * \. promotion_name: aoca_point.promotion_name
 * * \- 誤打訂正の返金金額が販売取引と同じであることを確認
 * * * \+ void_payments に現金（Cash）の支払い情報が含まれていること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 誤打訂正後の残高合計金額が0であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 11.【誤打訂正】取引終了 `/void/end`
 * * \- 合計ポイントが差し引かれることを確認し、レシートデータに「- sales.total_add_point」が含まれること
 * * \- レシートデータに「誤打訂正」という情報が含まれ、返金金額が販売取引と一致していることを確認
 */
export function TC_040244001_RefundCashSalesAndAocaPoints() {
  group("TC_040244001 現金売上かつAocaポイント付与の誤打訂正", () => {
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
    };

    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
    };

    // Run precondition to set Aok point equals 0
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const point = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    // If point = 0, no need to run this API
    if (point > 0) {
      TestHelper.settlementUsePoint(preStep.usePoint, {
        cardNo: CARD.AOKI_PREPAID.CODE,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        usagePointCount: point,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
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

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
    const totalAddPoint = salesCartInfo?.customer?.planning_add_points?.total_add_point;
    const aocaPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);

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

    const voidCartInfo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const totalBalanceAmount = voidCartInfo?.total_balance_amount;
    const payment = voidCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);

    TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: payment?.paid_amount,
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

    TestHelper.voidEnd(step.voidEnd, {
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
        name: "Verify receipt data must contain information: 誤打訂正 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            "誤打訂正",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
