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
 * @function ポイント〇倍デー
 * @memberof 誤打訂正.売上業務
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.SALES_OPERATIONS}
 * {@link TAGS.SALES}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * * ・ポイント〇倍デー（水/日）が付与された売上取引が誤打訂正できる。
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
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 9 | 【誤打訂正】支払登録 | `/void/addpayment` |
 * | 10 | 【誤打訂正】取引終了 | `/void/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_048で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.ポイント倍対象商品:  4520230413100
 * * 購入日にポイント5倍  5x_point_allday 
 * * * \+  sunday_promotion_enabled_flg-> saturday_promotion_enabled_flg : 1
 * * 2.ポイント倍対象外商品: 4520230413101 for
 * * 購入日にポイント0倍 0x_point_allday:
 * *  sunday_promotion_enabled_flg->  saturday_promotion_enabled_flg : 1
 * * 3.プロモーションの基準ポイント_Aoca: 
 * * * * \+ point_standard_amount: 100
 * * * * \+ add_standard_point: 1
 * * (設定：100円購入ごとで＋1ポイント)
 * * 4.プロモーションの5x_point_allday
 * * point_standard_rate: 5
 * * 5.プロモーションの0x_point_allday
 * * point_standard_rate: 0
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_048 にて確認済み）
 * * #### 7. 支払登録 `/sales/addpayment`
 * * \- sales.total_add_point のデータ取得
 * * \- Aoca ポイント取得: aoca_point = sales.point_detail[]（Aoca）
 * * \- 5倍ポイント取得: 5x_point = sales.point_detail[]（5x_point_allday）
 * * * 誤打訂正データが販売取引と一致していることを確認
 * * #### 10.【誤打訂正】支払登録 `/void/addpayment`
 * * \- 返却された合計ポイントが販売取引のポイントと一致していることを確認
 * * * \+ planning_add_points.total_add_point = sales.total_add_point
 * * \- 返却された Aoca ポイントが販売取引のポイントと一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること:
 * * * * \. add_point = aoca_point.add_point
 * * * * \. promotion_cd = aoca_point.promotion_cd
 * * * * \. promotion_name = aoca_point.promotion_name
 * * \- 返却された 5倍ポイントが販売取引のポイントと一致していることを確認
 * * * \+ planning_add_points.point_detail に以下が含まれること:
 * * * * \. add_point = 5x_point.add_point
 * * * * \. promotion_cd = 5x_point.promotion_cd
 * * * * \. promotion_name = 5x_point.promotion_name
 * * #### 11.【誤打訂正】取引終了 `/void/end`
 * * \- 合計ポイントが差し引かれており、レシートデータに「- sales.total_add_point」が含まれていることを確認
 */
export function TC_040250001_VoidMultiplyPoints() {
  group("TC_040250001 ポイント〇倍デー", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodeMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント倍対象商品スキャン "),
      barcodeUnMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント倍対象外商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
    };

    const barcodeOpTypeMemberReg = 8; // Test data. バーコード業務種別 (8: 会員登録)

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
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
      barcodeOperationType: barcodeOpTypeMemberReg,
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const totalAddPoint = salesCartInfo?.customer?.planning_add_points?.total_add_point;
    const salesAocaPointDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
    const salesPoint5xDetail = salesCartInfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.POINT_5X_ALLDAY.CD);

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
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const voidPayment = voidCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);

    TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: voidPayment?.paid_group_cd,
      paidCode: voidPayment?.paid_cd,
      paidAmount: voidPayment?.paid_amount,
      details: voidPayment?.details,
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
          addPoint: salesAocaPointDetail?.add_point,
          promotionCd: salesAocaPointDetail?.promotion_cd,
          promotionName: salesAocaPointDetail?.promotion_name,
        },
        actual: (res) => {
          const refundAocaPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.AOCA.CD);
          return {
            addPoint: refundAocaPointDetail?.add_point,
            promotionCd: refundAocaPointDetail?.promotion_cd,
            promotionName: refundAocaPointDetail?.promotion_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the the 5x point promotion points returned matches the sales transaction",
        expected: {
          addPoint: salesPoint5xDetail?.add_point,
          promotionCd: salesPoint5xDetail?.promotion_cd,
          promotionName: salesPoint5xDetail?.promotion_name,
        },
        actual: (res) => {
          const refundPoint5xDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION.POINT_5X_ALLDAY.CD);
          return {
            addPoint: refundPoint5xDetail?.add_point,
            promotionCd: refundPoint5xDetail?.promotion_cd,
            promotionName: refundPoint5xDetail?.promotion_name,
          };
        },
      }),
    ]);

    TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total point will be deducted",
        expected: true,
        actual: (res) => CommonFunction.checkReceiptData([
          `${-totalAddPoint}p`,
        ], res.result?.receipts),
      }),
    ]);
  });
}

/**
 * @function 500円券
 * @memberof 誤打訂正.売上業務
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.SALES_OPERATIONS}
 * {@link TAGS.SALES}
 * {@link TAGS.USE_500_YEN_COUPON}
 * ### テスト観点
 * * 前提：
 * * 取引0: (500円券を発券)
 * * 取引1：取引0で発券された500円券を利用（500円券利用によるポイントの変動なし）
 * * 取引2：取引1を誤打訂正
 * * テスト観点：
 * * テストの期待結果としては、取引完了時に500ポイントが加算されず、新しく500円券が発券されること
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引0: (500円券を発券) | - |
 * | 0 | Set the point of Aok card to 400 | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 5 | 売価変更 | `/sales/cart/changeitemprice` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | - | 取引1: (500円券利用) | - |
 * | 9 | 取引開始 | `/sales/begin` |
 * | 10 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 11 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 12 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 13 | 小計 | `/sales/subtotal` |
 * | 14 | 500円券スキャン（1枚） | `/sales/cart/barcode` |
 * | 15 | 支払登録 | `/sales/addpayment` |
 * | 16 | 取引完了 | `/sales/end` |
 * | 17 | Call common function getbalance | - |
 * | - | 取引2: (誤打訂正) | - |
 * | 18 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 19 | 【誤打訂正】支払登録 | `/void/addpayment` |
 * | 20 | 【誤打訂正】取引終了 | `/void/end` |
 * | 21 | Call common function getbalance | - |
 * 
 * ---
 * ### 前提条件
 * * 1.取引2:
 * *  取引1 の取引完了 `/sales/end`のバーコードを取得
 * * \- バーコード1 は prefix が 31、桁数は 20 桁
 * * \- バーコード2 は prefix が 36、桁数は 20 桁
 * * 2.販売取引はテストの観点に基づき、TC_018で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 取引1
 * * 1.クスリのアオキプリペイドカード: 8090227000000006 (AOCAカード)
 * * 2.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 取引2
 * * 1.Barcode 1 và Barcode 2
 * * 2.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 3.ポイント対象商品（上位参照）: 4500000000056 (point_apply_type_1 = 9)
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_018 にて確認済み）
 * * #### 10. Aocaカードスキャン `/sales/cart/barcode`
 * * \- original_point = sales.point_count_sum のデータ取得
 * * * 販売取引で 500円券を使用した場合のデータ確認
 * * #### 17. 共通関数 getbalance 呼び出し
 * * \- 500円券を使用してもポイント数が変わらないことを確認
 * * * \+ card_info.point_count_sum = original_point
 * * * 誤打訂正取引のデータ確認
 * * #### 20.【誤打訂正】取引終了 `/void/end`
 * * \- 500円券が1枚発券されていることを確認（XML に「５００円　お買物券」が含まれていること）
 * * #### 21. 共通関数 getbalance 呼び出し
 * * \- 誤打訂正後にポイントが 500 加算されないことを確認
 * * * \+ card_info.point_count_sum = original_point
 */
export function TC_040250002_VoidUse500YenVoucher() {
  group("TC_040250002 500円券", () => {
    // Precondition step to set point to 400
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      addPoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_ADD_POINT),
    };

    const step = {
      beginRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (取引0)`),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン (取引0)"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン (取引0)"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン (取引0)"),
      changePricePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE, `${ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE.desc} (取引0)`),
      subtotalRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (取引0)`),
      paymentRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (取引0)`),
      endRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (取引0)`),
      beginUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (取引1)`),
      barcodeAokiPrepaidUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン (取引1)"),
      barcodePointTargetUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン (取引1)"),
      barcodePointTargetReferUpperUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン (取引1)"),
      subtotalUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (取引1)`),
      barcodeUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（1枚） (取引1)"),
      paymentUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (取引1)`),
      endUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (取引1)`),
      generateKey1: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, `${ENDPOINT.TMN_PREPAID_CERTIFICATION.desc} (取引1)`),
      getBalanceAokiPrepaid1: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, `${ENDPOINT.TMN_PREPAID_GET_BALANCE.desc} (取引1)`),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN, `${ENDPOINT.VOID_BEGIN.desc} (取引2)`),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT, `${ENDPOINT.VOID_PAYMENT.desc} (取引2)`),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END, `${ENDPOINT.VOID_END.desc} (取引2)`),
      generateKey2: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, `${ENDPOINT.TMN_PREPAID_CERTIFICATION.desc} (取引2)`),
      getBalanceAokiPrepaid2: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, `${ENDPOINT.TMN_PREPAID_GET_BALANCE.desc} (取引2)`),
    };

    const barcodeOpTypeMemberReg = 8; // Test data. バーコード業務種別 (8: 会員登録)
    const barcodeOpTypePaymentAssist = 3; // Test data. バーコード業務種別 (3: 小計中)
    const updatedPrice = 100 * 100; // 100円 X 100 points. It will add 100 points. With precondition set 400 points, it will reach 500 point and release 500円 voucher
    const pointPrecondition = 400; // Precondition data
    const receiptNo = ENVIRONMENT.TMN_PREPAID_RECEIPT_NO;

    // 取引0: (issue 500 yen voucher)
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const point = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    if (point != pointPrecondition)
    {
      if (point > 0) {
        TestHelper.settlementUsePoint(preStep.usePoint, {
          cardNo: CARD.AOKI_PREPAID.CODE,
          receiptNo,
          usagePointCount: point,
        }, [
          CHECK.createStatusCodeCheck(),
        ]);
      };

      TestHelper.settlementAddPoint(preStep.addPoint, {
        cardNo: CARD.AOKI_PREPAID.CODE,
        receiptNo,
        designatedExtentionLimitPointCount: pointPrecondition,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    };

    let cartNo = TestHelper.salesBegin(step.beginRelease500YenVoucher, {}, [
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
      barcodeOperationType: barcodeOpTypeMemberReg,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

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

    TestHelper.salesCartChangeItemPrice(step.changePricePointTarget, {
      cartNo,
      statementNo: 0, // Change the price of the first item in the cart
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const cartInfo = TestHelper.salesSubtotal(step.subtotalRelease500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    let totalBalanceAmount = cartInfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.paymentRelease500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.endRelease500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    // Get barcode1 & barcode2 of ５００円券
    const {
      barcodePart1,
      barcodePart2,
    } = CommonFunction.getBarcodeData(salesEndResponse, /(31|36)\d{18}/g);

    // 取引1: (use 500 yen voucher)
    cartNo = TestHelper.salesBegin(step.beginUse500YenVoucher, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    const originalPoint = TestHelper.salesCartBarcode(step.barcodeAokiPrepaidUse, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: barcodeOpTypeMemberReg,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES).result?.cartinfo?.customer?.point_count_sum;

    TestHelper.salesCartBarcode(step.barcodePointTargetUse, {
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

    TestHelper.salesCartBarcode(step.barcodePointTargetReferUpperUse, {
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

    TestHelper.salesSubtotal(step.subtotalUse500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    totalBalanceAmount = TestHelper.salesCartBarcode(step.barcodeUse500YenVoucher, {
      cartNo,
      barcodes: [
        {
          barcode: barcodePart1,
          scan_data_type: "JAN13",
        },
        {
          barcode: barcodePart2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: barcodeOpTypePaymentAssist,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.paymentUse500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndUseResponse = TestHelper.salesEnd(step.endUse500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    // Get key and call common function getbalance
    TestHelper.tmnPrepaidCertification(step.generateKey1, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(step.getBalanceAokiPrepaid1, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify using the 500 yen voucher does not change the number of points",
        expected: originalPoint,
        actual: (res) => res.result?.card_info?.point_count_sum,
      }),
    ]);

    const salesReceiptNo = salesEndUseResponse.result?.receipt_no;
    const salesBusinessDay = salesEndUseResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    // 取引2: (void)
    const voidCartInfo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const voidPayment = voidCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: voidPayment?.paid_group_cd,
      paidCode: voidPayment?.paid_cd,
      paidAmount: voidPayment?.paid_amount,
      details: voidPayment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 1 voucher 500円 is issued",
        expected: true,
        actual: (res) => {
          const receiptVoucher = res.result?.receipts?.filter(q => q.receipt_type == RECEIPT_TYPE.SHOPPING_VOUCHER.VALUE);
          return CommonFunction.checkReceiptData([
            "５００円  お買物券",
          ], res.result?.receipts) && receiptVoucher?.length === 1;
        },
      }),
    ]);

    sleep(3);

    // Get key and call common function getbalance
    TestHelper.tmnPrepaidCertification(step.generateKey2, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(step.getBalanceAokiPrepaid2, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify no 500 points added after void transaction",
        expected: originalPoint,
        actual: (res) => res.result?.card_info?.point_count_sum,
      }),
    ]);
  });
}
