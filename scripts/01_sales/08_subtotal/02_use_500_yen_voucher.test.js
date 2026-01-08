import * as CHECK from "../../../common/common_check.js";
import { group, sleep } from "k6";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import { COUPON } from "../../../common/constant/coupon.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 発券～使用（正常系：500円券）
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.USE_500_YEN_COUPON}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * 500円券が発券されて即時に500円券が使用できる。
 * * * ・500円以上の買い物を行う。
 * * * * →　ポイント対象商品（対象）の合計金額が500円以上
 * * * ・500円券が1枚発券される。
 * * * ・支払登録画面で500円券を1枚スキャンする。
 * * * * →　合計金額から500円値引される。
 * * 前提：
 * * * ・m_store_itemにpoint_apply_type_1が1:（対象）　    →　ポイント対象商品（対象）
 * * * ・m_store_itemにpoint_apply_type_1が9:（上位参照）→　ポイント対象商品（上位参照）
 * * * ・ポイント対象商品（対象）の合計金額が500円以上であること。
 * * * ・m_voucherに500円券が設定されている
 * * * ・m_paymentに500円券が設定されている
 * * * ・m_paymentにpayment_typeが2:AOK(社値引券)と設定されている
 * * テスト観点：
 * * 取引①
 * * * ・ポイント対象商品（対象）を購入するとAocaポイントが500ポイント以上付与される
 * * * ・500ポイントごとに1枚の500円券が発券される。
 * * * ・Aocaポイントから500ポイントが減算される。
 * * 取引②
 * * * ・500円券を即時利用ができる。
 * * * ・500円券を利用した分、合計金額から値引される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引①: | - |
 * | 0 | Aocaカードのポイントを400に設定 | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 5 | 売価変更 | `/sales/cart/changeitemprice` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 共通関数 | `/getbalance` |
 * | - | 取引②: | - |
 * | 10 | 取引開始 | `/sales/begin` |
 * | 11 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 12 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 13 | 小計 | `/sales/subtotal` |
 * | 14 | 500円券スキャン（1枚）| `/sales/cart/barcode` |
 * | 15 | 支払登録 | `/sales/addpayment` |
 * | 16 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * #### 1. 取引②で利用するバーコードは取引①の「 取引完了 `/sales/end`」のレシートより抽出する
 * * \- Barcode 1： prefixが 「31」、20桁
 * * \- Barcode 2：prefixが「36」、20桁
 * 
 * ---
 * ### テストデータ
 * * 取引①:
 * * 1.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 2.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 3.ポイント対象商品（上位参照）: 4500000000056 (point_apply_type_1 = 9)
 * * 取引②:
 * * #### 1. 取引①の「 取引完了 `/sales/end`」のレシートより抽出したバーコード
 * * 2.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 3.ポイント対象商品（上位参照）: 4500000000056 (point_apply_type_1 = 9)
 * 
 * ---
 * ### 期待結果
 * * 取引①:
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- カート情報のカード情報確認
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 5.売価変更 `/sales/cart/changeitemprice`
 * * \- カート情報の付与予定合計ポイントを確認
 * * * \+ total_add_point: 500（ポイント対象商品（対象）購入によりのポイント）
 * * #### 8.取引完了 `/sales/end`
 * * レシートに以下を確認
 * * \- １つの500円券が発行されたこと(xmlに「５００円  お買物券」が含まれる)
 * * #### 9.共通関数 `/getbalance` (残高照会)
 * * \- 500ptが引かれること
 * * 取引②:
 * * #### 13.小計 `/sales/subtotal`
 * * \- total_balance_amount: 594
 * * #### 14.500円券スキャン（1枚）`/sales/cart/barcode`
 * * \- 支払登録されたのが500円券になっていること:
 * * * \+ payments.[].paid_cd = "0605"
 * * * \+ payments.[].paid_name= "500円券"
 * * * \+ payments.[].paid_amount= 500
 * * \- total_balance_amount = 94
 * * \- 支払金額の500円が正しく使用されていることを確認:
 * * * \+ item ポイント対象商品（対象） の価格は150、税率8%
 * * * * \. tax = display_unit_price × tax_rate / 100 = 150 × 8 / 100 = 12
 * * * * \. totalAmountWithTax = display_unit_price + tax = 150 + 12 = 162
 * * * \+ item ポイント対象商品（上位参照） の価格は500、税率8%、小計値引按分 100
 * * * * \. tax = (display_unit_price - subtotal_discount_apportionment) × tax_rate / 100 = (500 - 100) × 8 / 100 = 32
 * * * * \. totalAmountWithTax = (display_unit_price - subtotal_discount_apportionment) + tax = (500 - 100) + 32 = 432
 * * * \+ total_sales_amount = ポイント対象商品（対象）totalAmountWithTax + ポイント対象商品（上位参照）totalAmountWithTax = 162 + 432 = 594
 * * * \+ total_balance_amount = total_sales_amount - 500 = 594 - 500 = 94
 */
export function TC_010802001_ReleaseAndUse500YenVoucher() {
  group("TC_010802001 発券～使用（正常系：500円券）", () => {
    // Precondition step to set point to 400
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      addPoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_ADD_POINT),
    };

    const step = {
      beginRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      changePricePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      subtotalRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      paymentRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      endRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalanceAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      beginUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (2)`),
      barcodePointTargetUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(2)スキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      subtotalUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (2)`),
      barcodeUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（1枚）"),
      paymentUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (2)`),
      endUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (2)`),
    };

    const barcodeOpTypeMemberReg = 8; // Test data (type for MEMBER_REGISTRATION)
    const barcodeOpTypePaymentAssist = 3; // Test data (type for PAYMENT_ASSISTANCE)
    const updatedPrice = 100 * 100; // 100円 X 100 points. It will add 100 points. With precondition set 400 points, it will reach 500 point and release 500円 voucher
    const pointStandardAmount = 100; // Specified in master m_promotion_add_standard_point (When buying 100円, will add 1 point)
    const voucherAmount = 500; // For every 500 points, a 500円 voucher will be issued.
    const pointPrecondition = 400; // Precondition data
    const receiptNo = ENVIRONMENT.TMN_PREPAID_RECEIPT_NO;

    // Run precondition to set Aok point equals 400
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const point = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    // If point = 400, no need to run this API
    if (point != pointPrecondition) {
      // If point = 0, no need to run this API
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

    //取引①:
    //1. 取引開始 /sales/begin
    let cartNo = TestHelper.salesBegin(step.beginRelease500YenVoucher, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    //2.Aocaカードスキャン /sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify Aoca card scan successful",
        expected: {
          aokCd: CARD.AOKI_PREPAID.CODE,
          aokName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            aokCd: res.result?.cartinfo?.customer?.customer_cd,
            aokName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ], ENVIRONMENT.RETRY_TIMES);

    //3.ポイント対象商品（対象）スキャン /sales/cart/barcode
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

    //4.売価変更 /sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(step.changePricePointTarget, {
      cartNo,
      statementNo: 0,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total add point",
        expected: (res) => Formular.calcTotalAddPoint({ cartinfo: res.result?.cartinfo, pointStandardAmount }),
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
    ]);

    //5.小計 /sales/subtotal
    const cartInfo = TestHelper.salesSubtotal(step.subtotalRelease500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    let totalBalanceAmount = cartInfo?.total_balance_amount;
    const aocaAccountBalance = cartInfo?.customer?.point_count_sum + cartInfo?.customer?.planning_add_points?.total_add_point;

    //6.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.paymentRelease500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    //7.取引完了 /sales/end
    const salesEndResponse = TestHelper.salesEnd(step.endRelease500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify only one 500 yen voucher has been created",
        expected: {
          expected1: 1,
          expected2: 0,
        },
        actual: (res) => {
          sleep(3);
          let matches1 = 0;
          let matches2 = 0;
          // Check receipts[0]
          const receipt0 = res.result?.receipts?.[0]?.receipt_data;
          if (receipt0?.match(/５００円 {2}お買物券/g)) {
            matches1 = 1;
          }
          // Check receipts[1]
          const receipt1 = res.result?.receipts?.[1]?.receipt_data;
          if (receipt1?.match(/５００円 {2}お買物券/g)) {
            matches2 = 1;
          }
          return {
            expected1: matches1,
            expected2: matches2,
          };
        },
      }),
    ]);

    // Get barcode1 & barcode2 ５００円 from receipts[0]
    const {
      barcodePart1,
      barcodePart2,
    } = CommonFunction.getBarcodeData(salesEndResponse, /(31|36)\d{18}/g);

    //8.共通関数 /getbalance (残高照会)
    TestHelper.tmnPrepaidCertification(step.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(step.getBalanceAokiPrepaid, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify balance deducted 500 points",
        expected: voucherAmount,
        actual: (res) => aocaAccountBalance - res.result?.card_info?.point_count_sum,
      }),
    ]);

    //取引②:
    //9.取引開始 /sales/begin
    cartNo = TestHelper.salesBegin(step.beginUse500YenVoucher, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    //10.ポイント対象商品（対象） スキャン /sales/cart/barcode
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

    //11.ポイント対象商品（上位参照）スキャン /sales/cart/barcode
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

    //12.小計 /sales/subtotal
    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotalUse500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    //13.500円券スキャン（1枚）/sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify use voucher 500円",
        expected: {
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_NAME,
          paidAmount: voucherAmount,
        },
        actual: (res) => {
          return {
            paidCd: res.result?.cartinfo?.payments?.[0]?.paid_cd,
            paidName: res.result?.cartinfo?.payments?.[0]?.paid_name,
            paidAmount: res.result?.cartinfo?.payments?.[0]?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify outstanding balance",
        expected: totalBalanceAmount - voucherAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 500 yen discount used",
        expected: voucherAmount,
        actual: (res) => res.result?.cartinfo?.total_sales_amount - res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    //14.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.paymentUse500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    //15.取引完了 /sales/end
    TestHelper.salesEnd(step.endUse500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}

/**
 * @function 発券～使用（正常系：追加500円券）
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.USE_500_YEN_COUPON}
 * {@link TAGS.ADDITIONAL_500_YEN_COUPON_3_COUPONS_USED}
 * ### テスト観点
 * * 500円券を1取引で3枚使うごとに追加500円券を自動発行＆使用して、合計2000円分の値引がされる。
 * * * ・合計2000円以上の買い物を行う。
 * * * * →　商品A～Cの合計金額が2000円以上
 * * * ・支払登録画面で500円券を3枚スキャンする。
 * * * * →　追加500円券が発券されて合計金額から2000円値引される。
 * * 前提：
 * * 取引１：
 * * * ・m_store_itemにpoint_apply_type_1が1:（対象）　    →　ポイント対象商品（対象）
 * * * ・m_store_itemにpoint_apply_type_1が1:（対象）　    →　商品B
 * * * ・m_store_itemにpoint_apply_type_1が9:（上位参照）→　商品C
 * * * ・m_voucherに500円券が設定されている
 * * * ・m_paymentに500円券が設定されている
 * * * ・m_paymentにpayment_typeが2:AOK(社値引券)と設定されている
 * * 取引２：
 * * * ・商品の合計が2000円以上であること。
 * * テスト観点：
 * * 取引１：
 * * * ・商品AとBとCを購入するとAocaポイントが1500ポイント以上付与される
 * * * ・500ポイントごとに1枚の500円券が発券される。
 * * * ・Aocaポイントから500円券発行枚数×500ポイントが減算される。
 * * 取引２：
 * * * ・500円券を即時利用ができる。
 * * * ・500円券を3枚使用すると追加500円券が自動発行されて即時利用が出来る。
 * * * ・500円券を利用した分、合計金額から値引される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引１： | - |
 * | 0 | Aocaカードのポイントを0に設定 | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 4 | 売価変更 | `/sales/cart/changeitemprice` |
 * | - | => price: 150000 | - |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | - | => ３枚の５００円券 （枚1）,（枚2）,（枚3） | - |
 * | 8 | getbalanceを呼び出す | - |
 * | - | 取引２： | - |
 * | 9 | 取引開始 | `/sales/begin` |
 * | 10 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 11 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 12 | 売価変更 | `/sales/cart/changeitemprice` |
 * | - | => price:1500 | - |
 * | 13 | 小計 | `/sales/subtotal` |
 * | 14 | 500円券スキャン（枚1）| `/sales/cart/barcode` |
 * | 15 | 500円券スキャン（枚2）| `/sales/cart/barcode` |
 * | 15 | 500円券スキャン（枚3）| `/sales/cart/barcode` |
 * | 17 | 支払登録 | `/sales/addpayment` |
 * | 18 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * #### 1. 取引2のバーコードは  トランザクション１の取引完了 `/sales/end`から取得
 * * \- バーコード 1 ： prefix が 31, 文字長20文字
 * * \- バーコード２： prefix が 36, 文字長20文字
 * 
 * ---
 * ### テストデータ
 * * 取引①:
 * * 1.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 2.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 取引②:
 * * 1.トランザクション１の3枚の５００円券
 * * （各５００円券のバーコード１、バーコード２を取得）
 * * 2. 取引①の「 取引完了 `/sales/end`」のレシートより抽出したバーコード
 * * 3.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 4.ポイント対象商品（上位参照）: 4500000000056 (point_apply_type_1 = 9)
 * 
 * ---
 * ### 期待結果
 * * 取引１：
 * * #### 2.Aocaカードスキャン `/sales/cart/barcode`
 * * \- Aocaのスキャンの成功を確認
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 4.売価変更 `/sales/cart/changeitemprice`
 * * \- Aocaカードの付与されるポイントを確認
 * * * \+ total_add_point: 1500
 * * * \+ Aocaのポイントを確認
 * * #### 7.取引完了 `/sales/end`
 * * \- ３枚の５００円券の存在を確認 (xml データに５００円  お買物券があるかどうか確認)
 * * 8.Aocaポイントの情報を確認
 * * \- Aocaポイントに１５００ポイントがなくなることを確認
 * * 取引２：
 * * #### 13.小計 `/sales/subtotal`
 * * \-  Cart Info にて ２つの商品があるか確認:
 * * * \+ポイント対象商品（対象）:
 * * * \++ barcode:  4520230413001
 * * * \++ quantity: 1
 * * * \++ unit_price:  150
 * * * \++ display_unit_price: 1500
 * * * \++ total_statement_amount: 1500
 * * * \++ subtotal_discount_apportionment: 0
 * * * \++ rax_rate: 8
 * * * \+ ポイント対象商品（上位参照）：
 * * * \++ barcode: 4500000000056
 * * * \++ quantity: 1
 * * * \++ unit_price: 500
 * * * \++ display_unit_price: 500
 * * * \++ total_statement_amount: 400
 * * * \++ subtotal_discount_apportionment: 100
 * * * \++ rax_rate: 8
 * * \- 以下が正しいか確認
 * *  total_sales_amount: 2052 = 1500+1500*8% + (500-100) + (500-100)*8%
 * * #### 14.500円券スキャン（枚1）`/sales/cart/barcode`
 * * \-paymentsにて 500円券が利用されるか確認:
 * * * \+ payments.[0].paid_cd = "0605"
 * * * \+ payments.[0].paid_name= "500円券"
 * * * \+ payments.[0].paid_amount= 500
 * * * \+ payments.[0].voucher_group_cd= "0607"
 * * * \+ payments.[0].voucher_group_name= "500円券"
 * * #### 15.500円券スキャン（枚2）`/sales/cart/barcode`
 * * \- paymentsにて 500円券が利用されるか確認:
 * * * \+ payments.[1].paid_cd = "0605"
 * * * \+ payments.[1].paid_name= "500円券"
 * * * \+ payments.[1].paid_amount= 500
 * * * \+ payments.[1].voucher_group_cd= "0607"
 * * * \+ payments.[1].voucher_group_name= "500円券"
 * * #### 16.500円券スキャン（枚3）`/sales/cart/barcode`
 * * \- paymentsにて 500円券が利用されるか確認:
 * * * \+ payments.[2].paid_cd = "0605"
 * * * \+ payments.[2].paid_name= "500円券"
 * * * \+ payments.[2].paid_amount= 500
 * * * \+ payments.[2].voucher_group_cd= "0607"
 * * * \+ payments.[2].voucher_group_name= "500円券"
 * * \- paymentsにて 500円券が利用されるか確認 ( 追加500円券):
 * * * \+ payments.[3].paid_cd = "0605"
 * * * \+ payments.[3].paid_name= "500円券"
 * * * \+ payments.[3].paid_amount= 500
 * * * \+ payments.[3].voucher_group_cd= "0608"
 * * * \+ payments.[3].voucher_group_name= "追加500円券"
 * * \-2000円の金額が利用されたことを確認:
 * * #### + total_sales_amount = 2052 (13.小計 `/sales/subtotal` のtotal_sales_amount により)
 * * * \+ + total_balance_amount = total_sales_amount - payments[].paid_amount = 2052 - 500 -500 -500 -500 = 52
 * * * \+ total_sales_amount - total_balance_amount  = 2000
 */
export function TC_010802002_ReleaseAndUseAdditional500YenVoucher() {
  group("TC_010802002 発券～使用（正常系：追加500円券）", () => {
    const step = {
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePointAoka: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      changePrice1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      certification2: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, `${ENDPOINT.TMN_PREPAID_CERTIFICATION.desc} (2)`),
      getBalance2: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, `${ENDPOINT.TMN_PREPAID_GET_BALANCE.desc} (2)`),
      begin2: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (2)`),
      barcodePointTarget2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(2)スキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      changePrice2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE, `${ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE.desc} (2)`),
      subtotal2: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (2)`),
      barcode500yen: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（1枚）"),
      barcode500yen2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（2枚）"),
      barcode500yen3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（3枚）"),
      payment2: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (2)`),
      end2: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (2)`),
    };

    const cardNo = CARD.AOKI_PREPAID.CODE;
    const paidGroupCode = PAID_METHOD.QRCODE.GROUP_CODE;
    const paidCode = PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE;
    const details = ENVIRONMENT.LINEPAY_DETAIL;
    const voucher500yenBarcodePattern = /(31|36)\d{18}/g;
    const paidAmount500yen = 500;
    let barcode500Yens = [];

    // Reset Aoki Prepaid point
    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    const point = TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info.point_count_sum;

    if (point > 0) {
      TestHelper.settlementUsePoint(step.usePointAoka, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        usagePointCount: point,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    // 取引１：
    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: cardNo,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify Aoca card scan successful",
        expected: {
          aokCd: CARD.AOKI_PREPAID.CODE,
          aokName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            aokCd: res.result?.cartinfo?.customer?.customer_cd,
            aokName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
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

    let updatedPrice = 150000;
    const totalPoint = TestHelper.salesCartChangeItemPrice(step.changePrice1, {
      cartNo,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total add point",
        expected: (res) => Formular.calcPointItem({
          cartinfo: res.result?.cartinfo,
          addStandardPoint: 1, // master data aoca
          pointStandardAmount: 100, // master data aoca
        }),
        actual: (res) => res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
      }),
    ]).result?.cartinfo?.customer?.point_count_sum;

    let totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode,
      paidCode,
      totalBalanceAmount,
      details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify xml contain ５００円 (3) お買物券",
        expected: true,
        actual: (res) => {
          sleep(3);
          const receipts = res.result?.receipts;
          const indicesToCheck = [0, 1, 2];
          barcode500Yens = indicesToCheck.map(index =>
            CommonFunction.getBarcodeData(res, voucher500yenBarcodePattern, receipts?.[index]?.receipt_data),
          );

          return barcode500Yens.every(
            barcode => barcode?.barcodePart1 != null && barcode?.barcodePart2 != null,
          );
        },
      }),
    ]);

    const [barcode500YenFirst, barcode500YenSecond, barcode500YenThird] = barcode500Yens;

    TestHelper.tmnPrepaidCertification(step.certification2, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(step.getBalance2, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the Aoca Point account will be deducted by 1,500 points",
        expected: totalPoint,
        actual: (res) => res.result?.card_info?.point_count_sum,
      }),
    ]);

    // 取引２：
    cartNo = TestHelper.salesBegin(step.begin2, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodePointTarget2, {
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

    updatedPrice = 1500;
    TestHelper.salesCartChangeItemPrice(step.changePrice2, {
      cartNo,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal2, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total_sales_amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesCartBarcode(step.barcode500yen, {
      cartNo,
      barcodes: [
        {
          barcode: barcode500YenFirst.barcodePart1,
          scan_data_type: "JAN13",
        },
        {
          barcode: barcode500YenFirst.barcodePart2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the payment method uses a 500円 voucher",
        expected: {
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_NAME,
          paidAmount: paidAmount500yen,
          voucherGroupCd: COUPON.VOUCHER_500_YEN.GROUP_CD,
          voucherGroupName: COUPON.VOUCHER_500_YEN.GROUP_NAME,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.[0];
          return {
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcode500yen2, {
      cartNo,
      barcodes: [
        {
          barcode: barcode500YenSecond.barcodePart1,
          scan_data_type: "JAN13",
        },
        {
          barcode: barcode500YenSecond.barcodePart2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the payment method uses a 500円 voucher",
        expected: {
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_NAME,
          paidAmount: paidAmount500yen,
          voucherGroupCd: COUPON.VOUCHER_500_YEN.GROUP_CD,
          voucherGroupName: COUPON.VOUCHER_500_YEN.GROUP_NAME,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.[1];
          return {
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcode500yen3, {
      cartNo,
      barcodes: [
        {
          barcode: barcode500YenThird.barcodePart1,
          scan_data_type: "JAN13",
        },
        {
          barcode: barcode500YenThird.barcodePart2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the payment method uses a 500円 voucher",
        expected: {
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_NAME,
          paidAmount: paidAmount500yen,
          voucherGroupCd: COUPON.VOUCHER_500_YEN.GROUP_CD,
          voucherGroupName: COUPON.VOUCHER_500_YEN.GROUP_NAME,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.[2];
          return {
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the payment method uses a 500円 voucher (additional 500円 voucher)",
        expected: {
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_NAME,
          paidAmount: paidAmount500yen,
          voucherGroupCd: COUPON.VOUCHER_ADDITIONAL_500_YEN.GROUP_CD,
          voucherGroupName: COUPON.VOUCHER_ADDITIONAL_500_YEN.GROUP_NAME,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.[3];
          return {
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
            voucherGroupCd: payment?.voucher_group_cd,
            voucherGroupName: payment?.voucher_group_name,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the amount of 2,000円 has been used",
        expected: 2000, // 500円券を1取引で3枚使うごとに追加500円券を自動発行＆使用して、合計2000円分の値引が
        actual: (res) => res.result?.cartinfo?.total_sales_amount - res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.salesAddPayment(step.payment2, {
      cartNo,
      paidGroupCode,
      paidCode,
      totalBalanceAmount,
      details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end2, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}

/**
 * @function 発券～使用（異常系）
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.USE_500_YEN_COUPON}
 * {@link TAGS.EXPIRY_DATE_CHECK}
 * ### テスト観点
 * * 使用済の500円券を使用してエラー表示される
 * * 前提：
 * * * ・m_store_itemにpoint_apply_type_1が1:（対象）　    →　商品A
 * * * ・m_voucherに500円券が設定されている。
 * * * ・m_voucherのstart_datetime～end_datetimeが利用期間外となっていること。　
 * * * ・m_paymentに500円券が設定されている
 * * * ・m_paymentにpayment_typeが2:AOK(社値引券)と設定されている
 * * テスト観点：
 * * * ・500円券が利用期間外のため500円券をスキャンするとエラーになる。
 * * * ・エラー内容：
 * * * error_code: AGG0039
 * * * error_message: スキャンされた金券の有効期限が切れています
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 500円券を作成（有効期限外） | - |
 * | 2 | 取引開始 | `/sales/begin` |
 * | 3 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 利用期間外の500円券スキャン (ステップ１のバーコードを利用) | `/sales/cart/barcode` |
 * | - | →　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * （１）５００円券（有効期間外）を存在チェック、存在しない場合は共通関数で作成する
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 2.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 3.ポイント対象商品（上位参照） : 4500000000056
 * * 4.500円券は有効期間外
 * * {
 * *   "plan_no": "9800000050507",
 * *   "card_no": "8090227000000006",
 * *   "receipt_no": "221201008001000419",
 * *   "add_voucher_flg": "1",
 * *   "voucher_list": [
 * *     {
 * *       "barcode": "36008001230930999998",
 * *       "voucher_type_cd": "10",
 * *       "amount": 500,
 * *       "voucher_expiration_date": "2024-12-30"
 * *    }
 * *    ]
 * *}
 * * tpi_v1`/coupon/getvoucher`を利用
 * * * * →　確認 :   
 * *   "plan_no": "9800000050507",
 * *   "barcode": "36008001230930999998"
 * * まだない場合、５００円券を作成
 * * すでにあった場合、バーコード36008001230930999998を利用
 * 
 * ---
 * ### 期待結果
 * * #### 3.Aocaカードスキャン `/sales/cart/barcode`
 * * \- Aocaカードのスキャンを確認
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 7.利用期間外の500円券スキャン`/sales/cart/barcode`
 * * エラーコードとエラーメッセージを確認
 * * * \+ エラーメッセージ: "スキャンされた金券の有効期限が切れています。" .
 * * * \+ エラーコード: AGG0039
 */
export function TC_010802003_ReleaseAndUse500YenVoucher_Abnormal() {
  group("TC_010802003 発券～使用（異常系）", () => {
    const step = {
      certification: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getVoucher: CommonFunction.getFullDesc(ENDPOINT.GET_VOUCHER),
      createVoucher: CommonFunction.getFullDesc(ENDPOINT.CREATE_VOUCHER),
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      barcode500yen: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "利用期間外の500円券スキャン"),
    };

    const cardNo = CARD.AOKI_PREPAID.CODE;
    // Test data
    const voucher500yenExpBarcode1 = "31198000000505073657";
    const voucher500yenExpBarcode2 = "36008001230930999998";
    const voucher500yenExpDate = "2024-12-30";

    TestHelper.tmnPrepaidCertification(step.certification, [
      CHECK.createStatusCodeCheck(),
    ]);

    const getVoucherRes = TestHelper.getVoucher(step.getVoucher, {
      barcode: voucher500yenExpBarcode2,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    if (getVoucherRes.result?.voucher_list?.[0]?.voucher_status == "00") {
      TestHelper.createVoucher(step.createVoucher, {
        barcode: voucher500yenExpBarcode2,
        voucher_expiration_date: voucher500yenExpDate,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: cardNo,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 8,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify Aoca card scan successful",
        expected: {
          aokCd: CARD.AOKI_PREPAID.CODE,
          aokName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            aokCd: res.result?.cartinfo?.customer?.customer_cd,
            aokName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
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

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcode500yen, {
      cartNo,
      barcodes: [
        {
          barcode: voucher500yenExpBarcode1,
          scan_data_type: "JAN13",
        },
        {
          barcode: voucher500yenExpBarcode2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("AGG0039", "スキャンされた金券の有効期限が切れています。"),
    ]);
  });
}

/**
 * @function 発券～使用（異常系）
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.USE_500_YEN_COUPON}
 * {@link TAGS.USED_CHECK}
 * ### テスト観点
 * * 使用済の500円券を使用してエラー表示される
 * * 前提：
 * * * ・m_store_itemにpoint_apply_type_1が1:（対象）　    →　商品A
 * * * ・m_voucherに500円券が設定されている。
 * * * ・m_voucherのstart_datetime～end_datetimeが利用期間外となっていること。　
 * * * ・m_paymentに500円券が設定されている
 * * * ・m_paymentにpayment_typeが2:AOK(社値引券)と設定されている
 * * テスト観点：
 * * * ・500円券が利用済のため500円券をスキャンするとエラーになる。
 * * * ・エラー内容：
 * * * エラーコード: AGG0037
 * * * エラーメッセージ: スキャンされた金券は既に利用されています
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | TC_018を再度実行 | - |
 * | 2 | 取引開始 | `/sales/begin` |
 * | 3 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 5 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 使用済の500円券スキャン (Step1のバーコードを利用する) | `/sales/cart/barcode` |
 * | - | →　エラー終了 | - |
 * 
 * ---
 * ### 前提条件
 * * (1)TC_018を再実行し、利用済500円券を利用してテスト実行
 * 
 * ---
 * ### テストデータ
 * * 1.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 2.ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 3.ポイント対象商品（上位参照） : 4500000000056
 * * 4.利用済500円券
 * 
 * ---
 * ### 期待結果
 * * #### 3.Aocaカードスキャン `/sales/cart/barcode`
 * * \- Aocaカードのスキャンを確認
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 7.使用済の500円券スキャン`/sales/cart/barcode`
 * * エラーコードとエラーメッセージを確認
 * * * \+ エラーメッセージ: "スキャンされた金券は既に利用されています。
 * * * \+ エラーコード: AGG0037
 */
export function TC_010802004_ReleaseAndUse500YenVoucher_Abnormal() {
  group("TC_010802004 発券～使用（異常系）", () => {
    // 発券～使用（正常系：500円券）
    // Precondition step to set point to 400
    const preStep400Point = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      addPoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_ADD_POINT),
    };

    const preCreateUsed500YenVoucher = {
      beginRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      changePricePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      subtotalRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      paymentRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      endRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, `${ENDPOINT.TMN_PREPAID_CERTIFICATION.desc} (2)`),
      getBalanceAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, `${ENDPOINT.TMN_PREPAID_GET_BALANCE.desc} (2)`),
      beginUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (2)`),
      barcodePointTargetUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(2)スキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      subtotalUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (2)`),
      barcodeUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（1枚）"),
      paymentUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (2)`),
      endUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (2)`),
    };

    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (3)`),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン (2)"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン (3)"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン (2)"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (3)`),
      barcode500yenError: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "使用済の500円券スキャン"),
    };

    const barcodeOpTypeMemberReg = 8; // Test data (type for MEMBER_REGISTRATION)
    const barcodeOpTypePaymentAssist = 3; // Test data (type for PAYMENT_ASSISTANCE)
    const updatedPrice = 10000; // 100円 X 100 points. It will add 100 points. With precondition set 400 points, it will reach 500 point and release 500円 voucher
    const pointPrecondition = 400; // Precondition data

    // Run precondition to set Aok point equals 400
    TestHelper.tmnPrepaidCertification(preStep400Point.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const point = TestHelper.tmnPrepaidGetBalance(preStep400Point.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    // If point = 400, no need to run this API
    if (point != pointPrecondition) {
      if (point > 0) {
        TestHelper.settlementUsePoint(preStep400Point.usePoint, {
          cardNo: CARD.AOKI_PREPAID.CODE,
          receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
          usagePointCount: point,
        }, [
          CHECK.createStatusCodeCheck(),
        ]);
      };

      TestHelper.settlementAddPoint(preStep400Point.addPoint, {
        cardNo: CARD.AOKI_PREPAID.CODE,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        designatedExtentionLimitPointCount: pointPrecondition,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    };

    // 取引①:
    let cartNo = TestHelper.salesBegin(preCreateUsed500YenVoucher.beginRelease500YenVoucher, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(preCreateUsed500YenVoucher.barcodeAokiPrepaid, {
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

    TestHelper.salesCartBarcode(preCreateUsed500YenVoucher.barcodePointTarget, {
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

    TestHelper.salesCartChangeItemPrice(preCreateUsed500YenVoucher.changePricePointTarget, {
      cartNo,
      statementNo: 0,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const cartInfo = TestHelper.salesSubtotal(preCreateUsed500YenVoucher.subtotalRelease500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    let totalBalanceAmount = cartInfo?.total_balance_amount;

    TestHelper.salesAddPayment(preCreateUsed500YenVoucher.paymentRelease500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(preCreateUsed500YenVoucher.endRelease500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Get barcode1 & barcode2 ５００円 from receipts[0]
    const {
      barcodePart1,
      barcodePart2,
    } = CommonFunction.getBarcodeData(salesEndResponse, /(31|36)\d{18}/g);

    TestHelper.tmnPrepaidCertification(preCreateUsed500YenVoucher.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(preCreateUsed500YenVoucher.getBalanceAokiPrepaid, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 取引②:
    cartNo = TestHelper.salesBegin(preCreateUsed500YenVoucher.beginUse500YenVoucher, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(preCreateUsed500YenVoucher.barcodePointTargetUse, {
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

    TestHelper.salesCartBarcode(preCreateUsed500YenVoucher.barcodePointTargetReferUpper, {
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

    totalBalanceAmount = TestHelper.salesSubtotal(preCreateUsed500YenVoucher.subtotalUse500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    totalBalanceAmount = TestHelper.salesCartBarcode(preCreateUsed500YenVoucher.barcodeUse500YenVoucher, {
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

    TestHelper.salesAddPayment(preCreateUsed500YenVoucher.paymentUse500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(preCreateUsed500YenVoucher.endUse500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    cartNo = TestHelper.salesBegin(step.begin, {}, [
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
      CHECK.createEqualsCheck({
        name: "Verify Aoca card scan successful",
        expected: {
          aokCd: CARD.AOKI_PREPAID.CODE,
          aokName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            aokCd: res.result?.cartinfo?.customer?.customer_cd,
            aokName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
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

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcode500yenError, {
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
      barcodeOperationType: 3,
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("AGG0037", "スキャンされた金券は既に利用されています。"),
    ]);
  });
}
